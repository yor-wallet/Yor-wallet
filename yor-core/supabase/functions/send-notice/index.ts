import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildDeliveryRequest, buildEmail, buildNoticeSms, buildNotificationSms, buildSmsRequest, classifyDelivery, classifySms, cleanService, isInternational,
  noticeSmsLang, recipientNumber, recipientSmsLang, retryDelayMin, senderLabel, senderNoticeLang, safeEqual, smsProviderName, smsSegments,
  type Lang, type NoticeData, type SmsEnv,
} from "./lib.ts";

/* send-notice : messages d'un transfert (SMS + e-mail).
   - audience EXTERNAL / INTERNAL : message au bénéficiaire ;
   - audience SENDER : confirmation du débit envoyée à l'expéditeur lui-même.
   La base remplit la file public.recipient_notices dès que le transfert est enregistré, puis APPELLE ELLE-MÊME cette fonction (pg_net) : les deux SMS
   (expéditeur et destinataire) partent tout de suite, sans bouton ni validation. Un balayage toutes les minutes (pg_cron) relance un envoi qui a échoué.
   L'application appelle aussi cette fonction juste après l'envoi (et à l'ouverture du reçu) : doublon sans effet, la file est réclamée une seule fois.
   Authentification : (1) le jeton interne de la base (en-tête x-notice-token, table privée notice_dispatch_cfg) ; ou (2) le jeton de connexion de la
   personne (verify_jwt) — seul l'expéditeur de la transaction peut alors la déclencher. */

const FROM_EMAIL = "yordigitalefinance@gmail.com";   // expéditeur officiel fixe, identique à send-email
const FROM_NAME = (Deno.env.get("NOTICE_FROM_NAME") ?? "Friendly Pay").replace(/\b(?:YOR|NEX)(?:\s+WALLET)?\b/gi, "Friendly Pay");   // 12.9.0 : Friendly Pay (une ancienne valeur « YOR WALLET » / « NEX WALLET » du secret est corrigée)
const BREVO_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
/* SMS : fournisseur choisi par le secret SMS_PROVIDER (brevo par défaut | infobip | twilio). L'e-mail passe toujours par Brevo. */
const SMS_PROVIDER = smsProviderName(Deno.env.get("SMS_PROVIDER"), Deno.env.get("INFOBIP_API_KEY") ?? undefined);
const SMS_ENV: SmsEnv = {
  sender: Deno.env.get("SMS_SENDER") ?? undefined, brevoKey: BREVO_KEY || undefined,
  infobipKey: Deno.env.get("INFOBIP_API_KEY") ?? undefined, infobipBase: Deno.env.get("INFOBIP_BASE_URL") ?? undefined,
  twilioSid: Deno.env.get("TWILIO_ACCOUNT_SID") ?? undefined, twilioToken: Deno.env.get("TWILIO_AUTH_TOKEN") ?? undefined,
  twilioFrom: Deno.env.get("TWILIO_FROM") ?? undefined,
};

/* Modèle des SMS : « structured » (défaut, 12.5.0 : « Dear Customer / عزيزي العميل », solde disponible) ou « compact » (anciens gabarits d'une ligne). Secret SMS_TEMPLATE. */
const SMS_TEMPLATE: "structured" | "compact" = (Deno.env.get("SMS_TEMPLATE") ?? "structured").trim().toLowerCase() === "compact" ? "compact" : "structured";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
const SUCCESS = ["CONFIRMED", "SUCCESS", "COMPLETED"];

async function langOf(userId: string | null): Promise<Lang> {
  if (!userId) return "en";
  const { data } = await sb.from("user_docs").select("data").eq("user_id", userId).eq("doc_name", "preferences").maybeSingle();
  const l = data?.data?.language;
  return l === "fr" || l === "ar" || l === "en" ? l : "en";
}

async function load(n: Row): Promise<{ d: NoticeData; lang: Lang } | { skip: string }> {
  const { data: tx } = await sb.from("transactions").select("*").eq("id", n.transaction_id).maybeSingle();
  if (!tx) return { skip: "transaction_not_found" };
  if (!SUCCESS.includes(tx.status)) return { skip: `status_${tx.status}` };
  let from = "", senderCountry = "";
  if (tx.sender_id) {
    const { data: p } = await sb.from("profiles").select("first_name, last_name, country").eq("id", tx.sender_id).maybeSingle();
    from = senderLabel(p?.first_name, p?.last_name);
    senderCountry = String(p?.country ?? "");
  }
  const meta: Row = tx.meta ?? {};
  const destOk = (n.audience === "EXTERNAL" || n.audience === "SENDER") && meta.destinationAmount != null && meta.destinationCurrency;
  /* Numéro du bénéficiaire pour la confirmation à l'expéditeur : le numéro international normalisé par la base (ligne EXTERNAL de la même
     transaction), sinon la saisie de l'expéditeur. Complet pour un service par téléphone, masqué pour un compte bancaire (recipientNumber). */
  let benTo = "";
  if (n.audience === "SENDER") {
    const { data: ext } = await sb.from("recipient_notices").select("to_phone").eq("transaction_id", n.transaction_id).eq("audience", "EXTERNAL").eq("channel", "SMS").maybeSingle();
    benTo = recipientNumber(meta.beneficiary?.identifierType, ext?.to_phone, meta.beneficiary?.phone);
  }
  /* Transfert INTERNE entre deux comptes de l'application : le destinataire est un compte, on montre son nom (« Adam K. ») à l'expéditeur. */
  let toName = "";
  if (n.audience === "SENDER" && tx.kind === "FIAT_TRANSFER" && tx.receiver_id) {
    const { data: rp } = await sb.from("profiles").select("first_name, last_name").eq("id", tx.receiver_id).maybeSingle();
    toName = senderLabel(rp?.first_name, rp?.last_name);
  }
  /* Message au BÉNÉFICIAIRE : on lui montre le NUMÉRO de l'expéditeur (décidé avec le propriétaire du produit, 12 octobre 2026). C'est le numéro que la base a
     déjà normalisé pour la confirmation de l'expéditeur (Réglages → numéro des confirmations SMS, à défaut le numéro du profil) : la ligne SENDER du même
     transfert. Aucun numéro enregistré → rien n'est inventé, le message garde le nom « Prénom I. ». */
  let fromPhone = "";
  if (n.audience !== "SENDER") {
    const { data: snd } = await sb.from("recipient_notices").select("to_phone").eq("transaction_id", n.transaction_id).eq("audience", "SENDER").eq("channel", "SMS").maybeSingle();
    const digits = String(snd?.to_phone ?? "").replace(/\D/g, "");
    if (digits.length >= 8 && digits.length <= 15) fromPhone = "+" + digits;
  }
  /* Message au BÉNÉFICIAIRE (modèle arabe, 12 octobre 2026) : « إلى الحساب » = le compte du bénéficiaire tel que la base l'a normalisé (numéro complet pour un
     service par téléphone, masqué pour un compte bancaire) ; le transfert est « international » seulement si le pays de l'expéditeur et celui du bénéficiaire
     sont connus ET différents (pays du service pour un transfert externe, pays du profil du destinataire pour un transfert interne). Rien n'est supposé. */
  let account = "", international = false;
  let tzCountry = senderCountry;                        // 12.12.0 : heure locale du pays de la personne qui lit le message (expéditeur → son pays ; bénéficiaire → le sien)
  if (n.audience !== "SENDER") {
    let otherCountry = "";
    if (n.audience === "EXTERNAL") {
      account = recipientNumber(meta.beneficiary?.identifierType, n.to_phone, meta.beneficiary?.phone);
      otherCountry = String(n.country ?? "");
    } else {
      const digits = String(n.to_phone ?? "").replace(/\D/g, "");
      if (digits.length >= 8 && digits.length <= 15) account = "+" + digits;
      if (tx.receiver_id) {
        const { data: rp } = await sb.from("profiles").select("country").eq("id", tx.receiver_id).maybeSingle();
        otherCountry = String(rp?.country ?? "");
      }
    }
    international = isInternational(senderCountry, otherCountry);
    tzCountry = otherCountry;
  }
  /* Nom du bénéficiaire d'un envoi EXTERNE (saisi par l'expéditeur) ; vide si la base n'a gardé que le numéro comme nom. Virement bancaire : banque + compte masqué. */
  if (n.audience === "SENDER" && tx.kind === "FIAT_EXTERNAL") {
    if (meta.flow) {
      toName = cleanService(meta.bankName);
      const last4 = String(meta.accountMask ?? "").replace(/\D/g, "").slice(-4);
      if (last4.length === 4) benTo = "***" + last4;
    } else if (meta.beneficiary?.name) {
      toName = String(meta.beneficiary.name);
    }
  }
  /* Solde disponible : valeur du REGISTRE pour cette transaction (ledger_entries.balance_after, écrit par la base au moment du débit / du crédit).
     Expéditeur = son débit ; bénéficiaire d'un compte de l'application = son crédit. Bénéficiaire externe : pas de compte, pas de solde. Rien n'est calculé ici. */
  let balance: { amount: number; currency: string } | null = null;
  const balanceUser = n.audience === "SENDER" ? tx.sender_id : n.audience === "INTERNAL" ? tx.receiver_id : null;
  if (balanceUser) {
    const { data: le } = await sb.from("ledger_entries").select("balance_after, asset").eq("transaction_id", n.transaction_id).eq("user_id", balanceUser)
      .order("id", { ascending: false }).limit(1).maybeSingle();
    if (le && le.balance_after != null && Number.isFinite(Number(le.balance_after))) balance = { amount: Number(le.balance_after), currency: String(le.asset ?? tx.asset ?? "OMR") };
  }
  const d: NoticeData = {
    audience: n.audience, amount: Number(tx.amount), ...(balance ? { balance } : {}), currency: String(tx.asset ?? "OMR"),
    dest: destOk ? { amount: Number(meta.destinationAmount), currency: String(meta.destinationCurrency) } : null,
    tzCountry, from, ...(fromPhone ? { fromPhone } : {}), ...(n.audience !== "SENDER" ? { account, international } : {}), ref: String(tx.reference ?? ""), createdAt: tx.created_at,
    service: cleanService(meta.provider),                       // Orange Money, Wave… : le SMS s'adapte au service
    // confirmation à l'expéditeur : détail du débit lu dans la transaction (montant + frais + TVA), jamais calculé ici
    ...(n.audience === "SENDER" ? {
      total: tx.total != null ? Number(tx.total) : null,
      to: benTo,
      toName,
      rate: meta.rate != null ? Number(meta.rate) : null,
    } : {}),
  };
  /* Langue : confirmation à l'expéditeur = arabe si son compte est dans un pays arabophone (Oman…), quel que soit le service ;
     sinon la langue du service choisi, à défaut la langue de la personne (voir senderNoticeLang).
     Message au bénéficiaire = langue de son compte s'il en a un ; sinon ANGLAIS, quel que soit son pays (décidé avec le propriétaire du produit,
     10 octobre 2026 : « bien fait en anglais » pour les numéros d'Oman et de Côte d'Ivoire). */
  /* SMS : confirmation à l'expéditeur et message au bénéficiaire en SMS_LANG (anglais, style notification bancaire — décidé le 10 octobre 2026), SAUF le message
     au bénéficiaire d'un pays arabophone (ou d'un compte réglé en arabe) : modèle arabe du 12 octobre 2026 (voir recipientSmsLang). Les e-mails gardent les règles ci-dessus. */
  const lang: Lang = n.channel === "SMS"
    ? (SMS_TEMPLATE === "compact"
      ? recipientSmsLang(n.audience, n.country, n.audience !== "SENDER" && n.user_id ? await langOf(n.user_id) : null)
      : noticeSmsLang(n.audience, n.country, n.user_id ? await langOf(n.user_id) : null))
    : n.audience === "SENDER"
      ? senderNoticeLang(senderCountry, n.country, await langOf(n.user_id))
      : (n.user_id ? await langOf(n.user_id) : "en");
  return { d, lang };
}

async function process(n: Row, dry = false): Promise<Row> {
  const built = await load(n);
  if ("skip" in built) {
    if (!dry) await sb.from("recipient_notices").update({ status: "SKIPPED", locked_at: null, error_message: built.skip }).eq("id", n.id);
    return { id: n.id, status: "SKIPPED", reason: built.skip };
  }
  const { d, lang } = built;
  if (n.channel === "EMAIL" && n.audience === "INTERNAL") {
    if (!dry) await sb.from("recipient_notices").update({ status: "SKIPPED", locked_at: null, error_message: "email_not_supported" }).eq("id", n.id);
    return { id: n.id, status: "SKIPPED", reason: "email_not_supported" };
  }
  const sms = n.channel === "SMS" ? (SMS_TEMPLATE === "compact" ? buildNoticeSms(lang, d) : buildNotificationSms(lang, d)) : null;
  const mail = n.channel === "EMAIL" ? buildEmail(lang, d) : null;
  if (dry) return { id: n.id, channel: n.channel, lang, sms, sms_info: sms ? smsSegments(sms) : null, email_subject: mail?.subject ?? null, email_html_bytes: mail ? mail.html.length : null };

  const defer = async (msg: string, minutes: number) => {
    await sb.from("recipient_notices").update({ status: "PENDING", locked_at: null, language: lang, error_message: msg.slice(0, 500), next_attempt_at: new Date(Date.now() + minutes * 60000).toISOString() }).eq("id", n.id);
    return { id: n.id, status: "PENDING", error: msg };
  };
  const fail = async (msg: string, terminal = false) => {
    const attempts = terminal ? 5 : n.attempts + 1;
    await sb.from("recipient_notices").update({ status: "FAILED", locked_at: null, language: lang, attempts, error_message: msg.slice(0, 500), next_attempt_at: new Date(Date.now() + retryDelayMin(attempts) * 60000).toISOString() }).eq("id", n.id);
    return { id: n.id, status: "FAILED", error: msg };
  };
  const sent = async (messageId: string | null) => {
    /* delivery_status : « PENDING » = on interrogera le fournisseur (Infobip, Twilio) ; « UNSUPPORTED » = ce fournisseur n'a pas de suivi ici ; e-mail : aucun. */
    const delivery = n.channel !== "SMS" ? {} : { delivery_status: messageId && SMS_PROVIDER !== "brevo" ? "PENDING" : "UNSUPPORTED", delivery_checked_at: null, delivered_at: null, delivery_error: null };
    await sb.from("recipient_notices").update({ status: "SENT", locked_at: null, language: lang, sent_at: new Date().toISOString(), provider_message_id: messageId, error_message: null, attempts: n.attempts + 1, ...delivery }).eq("id", n.id);
    return { id: n.id, status: "SENT", messageId };
  };

  try {
    if (sms !== null) {
      if (!n.to_phone) return await fail("no_phone", true);
      const info = smsSegments(sms);
      const req = buildSmsRequest(SMS_PROVIDER, SMS_ENV, n.to_phone, sms, info.unicode);
      if ("error" in req) return req.terminal ? await fail(req.error, true) : await defer(req.error, 5);
      const res = await fetch(req.url, { method: "POST", headers: req.headers, body: req.body });
      const o = classifySms(SMS_PROVIDER, res.status, await res.text());
      if (o.kind === "sent") return await sent(o.messageId);
      if (o.kind === "defer") return await defer(o.reason, o.minutes);
      if (o.kind === "terminal") return await fail(o.reason, true);
      return await fail(o.reason);
    }
    // e-mail (toujours Brevo)
    if (!BREVO_KEY) return await defer("provider not configured: BREVO_API_KEY secret missing", 5);
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_KEY, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sender: { name: FROM_NAME, email: FROM_EMAIL }, replyTo: { name: FROM_NAME, email: FROM_EMAIL },
        to: [{ email: n.to_email }], subject: mail!.subject, htmlContent: mail!.html, tags: ["RECIPIENT_NOTICE"] }),
    });
    const text = await res.text();
    let body: Row = {};
    try { body = JSON.parse(text); } catch { /* texte brut */ }
    if (res.ok) return await sent(body.messageId ?? null);
    const msg = `brevo ${res.status}: ${text}`.slice(0, 500);
    if (res.status === 401 || res.status === 403 || (res.status === 400 && /sender/i.test(text))) return await defer(msg, 10);
    return await fail(msg);
  } catch (e) {
    return await fail(`network: ${String(e)}`);
  }
}

/* Suivi de la livraison : pour les SMS « SENT » des dernières 24 h dont la remise n'est pas encore connue, on interroge le fournisseur (Infobip / Twilio).
   Un SMS « SENT » n'est JAMAIS marqué « DELIVERED » sans rapport positif du fournisseur ; une réponse incomplète ou une erreur temporaire laisse « PENDING »
   (et le motif est gardé dans delivery_error) ; sans rapport au bout de 24 h : « UNKNOWN ». */
async function checkDelivery(limit = 20): Promise<number> {
  const day = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  await sb.from("recipient_notices").update({ delivery_status: "UNKNOWN", delivery_error: "no_report_24h", delivery_checked_at: new Date().toISOString() })
    .eq("channel", "SMS").eq("status", "SENT").eq("delivery_status", "PENDING").lt("sent_at", day);
  if (SMS_PROVIDER === "brevo") return 0;
  const recheck = new Date(Date.now() - 90 * 1000).toISOString();
  const { data: rows } = await sb.from("recipient_notices").select("id, provider_message_id")
    .eq("channel", "SMS").eq("status", "SENT").eq("delivery_status", "PENDING").not("provider_message_id", "is", null)
    .gte("sent_at", day).or(`delivery_checked_at.is.null,delivery_checked_at.lt.${recheck}`).order("sent_at").limit(limit);
  let done = 0;
  for (const r of (rows ?? []) as Row[]) {
    const now = new Date().toISOString();
    const req = buildDeliveryRequest(SMS_PROVIDER, SMS_ENV, String(r.provider_message_id));
    if ("error" in req) {
      await sb.from("recipient_notices").update({ delivery_checked_at: now, delivery_error: req.error.slice(0, 200), ...(req.unsupported ? { delivery_status: "UNSUPPORTED" } : {}) }).eq("id", r.id);
      continue;
    }
    try {
      const res = await fetch(req.url, { headers: req.headers });
      const o = classifyDelivery(SMS_PROVIDER, res.status, await res.text());
      const patch: Row = { delivery_checked_at: now, delivery_error: o.state === "DELIVERED" ? null : o.detail.slice(0, 200) };
      if (o.state === "DELIVERED") { patch.delivery_status = "DELIVERED"; patch.delivered_at = now; }
      else if (o.state === "UNDELIVERABLE") patch.delivery_status = "UNDELIVERABLE";
      await sb.from("recipient_notices").update(patch).eq("id", r.id);
      done++;
    } catch (e) {
      await sb.from("recipient_notices").update({ delivery_checked_at: now, delivery_error: `network: ${String(e)}`.slice(0, 200) }).eq("id", r.id);
    }
  }
  return done;
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", ...CORS } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Row = {};
  try { body = await req.json(); } catch { /* corps vide */ }
  const txId = String(body.tx_id ?? "");

  let ids: Row[] | null = null;
  const presented = req.headers.get("x-notice-token") ?? "";
  if (presented) {
    /* DÉCLENCHEMENT AUTOMATIQUE (base de données) : dès qu'un transfert est enregistré, la base appelle cette fonction avec un jeton interne.
       Le jeton vit dans la table privée notice_dispatch_cfg (aucun accès public) ; il est comparé à durée constante. Sans jeton valide : 401.
       Le déclenchement ne fait qu'envoyer les messages DÉJÀ mis en file par la base (idempotent, respecte next_attempt_at et les 5 tentatives). */
    const { data: cfg } = await sb.from("notice_dispatch_cfg").select("token").eq("id", true).maybeSingle();
    if (!safeEqual(presented, cfg?.token)) return json({ error: "unauthorized" }, 401);
    if (UUID.test(txId)) {
      ({ data: ids } = await sb.from("recipient_notices").select("id").eq("transaction_id", txId).in("status", ["PENDING", "FAILED", "SENDING"]));
    } else {
      /* balayage : messages en attente dont l'heure est venue (nouvelle tentative automatique après un échec du fournisseur).
         Seulement ceux des 2 dernières heures : une confirmation vieille de plusieurs heures n'a plus de sens (elle expire à 24 h). */
      ({ data: ids } = await sb.from("recipient_notices").select("id").in("status", ["PENDING", "FAILED"]).lt("attempts", 5)
        .lte("next_attempt_at", new Date().toISOString()).gte("created_at", new Date(Date.now() - 2 * 3600 * 1000).toISOString())
        .order("created_at").limit(20));
    }
  } else {
    // 1. qui appelle ? (le jeton est déjà vérifié par la plateforme ; on retrouve ici l'utilisateur)
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u, error: ue } = token ? await sb.auth.getUser(token) : { data: { user: null }, error: new Error("no token") };
    if (ue || !u?.user?.id) return json({ error: "unauthorized" }, 401);
    if (!UUID.test(txId)) return json({ error: "invalid_tx_id" }, 400);

    // 2. cet utilisateur est-il l'expéditeur de la transaction ?
    const { data: tx } = await sb.from("transactions").select("id, sender_id").eq("id", txId).maybeSingle();
    if (!tx || tx.sender_id !== u.user.id) return json({ error: "forbidden" }, 403);

    // 3. vider la file de cette transaction (respecte next_attempt_at : un appel répété est sans effet)
    ({ data: ids } = await sb.from("recipient_notices").select("id").eq("transaction_id", txId).in("status", ["PENDING", "FAILED", "SENDING"]));
  }
  const results: Row[] = [];
  for (const { id } of (ids ?? []) as Row[]) {
    const { data: claimed, error } = await sb.rpc("claim_recipient_notices", { p_id: id, p_limit: 1 });
    if (error) { results.push({ error: error.message }); continue; }
    for (const n of (claimed ?? []) as Row[]) {
      try { results.push(redact(await process(n))); }
      catch (e) {
        await sb.from("recipient_notices").update({ status: "FAILED", locked_at: null, attempts: n.attempts + 1, error_message: String(e).slice(0, 500),
          next_attempt_at: new Date(Date.now() + retryDelayMin(n.attempts + 1) * 60000).toISOString() }).eq("id", n.id);
        results.push({ channel: n.channel, status: "FAILED" });
      }
    }
  }
  /* balayage automatique (sans tx_id) : on relit aussi les rapports de livraison */
  let deliveryChecked: number | undefined;
  if (presented && !UUID.test(txId)) { try { deliveryChecked = await checkDelivery(); } catch { /* le suivi est informatif : il ne bloque jamais l'envoi */ } }
  return json({ processed: results.length, results, ...(deliveryChecked !== undefined ? { delivery_checked: deliveryChecked } : {}) });
});

// La réponse ne contient ni numéro, ni e-mail, ni message d'erreur du fournisseur.
function redact(r: Row): Row { return { channel: r.channel ?? undefined, status: r.status }; }
