import { createClient } from "npm:@supabase/supabase-js@2";

// ---- Fixed official sender: never configurable from outside ----
// 12.9.0 : le nom est Friendly Pay (identifiants affichés FRD-…) ; les e-mails de transaction n'affichent AUCUN solde (ni avant, ni après).
const FROM_EMAIL = "yordigitalefinance@gmail.com";
const FROM_NAME = "Friendly Pay";
const REPLY_TO = FROM_EMAIL;
const APP_URL = (Deno.env.get("APP_URL") ?? "").trim();
const BREVO_KEY = Deno.env.get("BREVO_API_KEY") ?? "";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

type Lang = "fr" | "en" | "ar";
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

const T: Record<Lang, Row> = {
  fr: {
    dir: "ltr", locale: "fr-FR",
    welcomeSubject: "Bienvenue sur Friendly Pay",
    welcomeTitle: (n: string) => `Bienvenue sur Friendly Pay, ${n} !`,
    welcomeBody: "Votre compte est confirmé. Vous pouvez dès maintenant envoyer, recevoir et gérer votre argent en toute sécurité avec Friendly Pay.",
    open: "Ouvrir Friendly Pay",
    supportLine: "Besoin d'aide ? Écrivez-nous :",
    company: "Friendly Pay est un service de Friendly.",
    privacy: "Confidentialité", terms: "Conditions",
    sentSubject: (a: string) => `Transaction réussie : ${a}`,
    recvSubject: (a: string) => `Vous avez reçu ${a}`,
    sentTitle: "Votre transaction a réussi", recvTitle: "Vous avez reçu de l'argent",
    f: { type: "Type", amount: "Montant", to: "Bénéficiaire", from: "Expéditeur", yor: "Friendly ID", phone: "Téléphone", service: "Service",
      address: "Adresse de destination", network: "Réseau", memo: "Mémo",
      rate: "Taux de change", dest: "Montant à recevoir", debited: "Montant débité", received: "Montant reçu",
      fee: "Frais", date: "Date", time: "Heure", ref: "Référence", status: "Statut" },
    ok: "Réussie",
    kinds: { FIAT_TRANSFER: "Transfert Friendly ID", FIAT_EXTERNAL: "Transfert international", CRYPTO_TRANSFER: "Transfert crypto", ADMIN_DEPOSIT: "Dépôt",
      CRYPTO_BUY: "Achat crypto", CRYPTO_SELL: "Vente crypto", CRYPTO_SWAP: "Échange crypto", CRYPTO_SEND: "Envoi crypto externe", CRYPTO_TO_BANK: "Crypto vers banque" },
    sec: {
      SEC_PASSWORD_CHANGED: ["Votre mot de passe a été modifié", "Le mot de passe de votre compte Friendly Pay vient d'être modifié."],
      SEC_EMAIL_CHANGED: ["L'adresse e-mail de votre compte a changé", "L'adresse e-mail de votre compte Friendly Pay vient d'être modifiée"],
      SEC_PIN_CHANGED: ["Votre code PIN a été modifié", "Le code PIN de votre compte Friendly Pay vient d'être modifié."],
      SEC_NEW_DEVICE: ["Nouvelle connexion à votre compte", "Une connexion à votre compte Friendly Pay a été détectée depuis un nouvel appareil."],
      warn: "Si ce n'est pas vous, contactez immédiatement notre support :",
    },
  },
  en: {
    dir: "ltr", locale: "en-GB",
    welcomeSubject: "Welcome to Friendly Pay",
    welcomeTitle: (n: string) => `Welcome to Friendly Pay, ${n}!`,
    welcomeBody: "Your account is confirmed. You can now send, receive and manage your money securely with Friendly Pay.",
    open: "Open Friendly Pay",
    supportLine: "Need help? Write to us:",
    company: "Friendly Pay is a service of Friendly.",
    privacy: "Privacy", terms: "Terms",
    sentSubject: (a: string) => `Transaction successful: ${a}`,
    recvSubject: (a: string) => `You received ${a}`,
    sentTitle: "Your transaction was successful", recvTitle: "You received money",
    f: { type: "Type", amount: "Amount", to: "Recipient", from: "Sender", yor: "Friendly ID", phone: "Phone", service: "Service",
      address: "Destination address", network: "Network", memo: "Memo",
      rate: "Exchange rate", dest: "Amount to receive", debited: "Amount debited", received: "Amount received",
      fee: "Fees", date: "Date", time: "Time", ref: "Reference", status: "Status" },
    ok: "Successful",
    kinds: { FIAT_TRANSFER: "Friendly ID transfer", FIAT_EXTERNAL: "International transfer", CRYPTO_TRANSFER: "Crypto transfer", ADMIN_DEPOSIT: "Deposit",
      CRYPTO_BUY: "Crypto purchase", CRYPTO_SELL: "Crypto sale", CRYPTO_SWAP: "Crypto swap", CRYPTO_SEND: "External crypto send", CRYPTO_TO_BANK: "Crypto to bank" },
    sec: {
      SEC_PASSWORD_CHANGED: ["Your password was changed", "The password of your Friendly Pay account was just changed."],
      SEC_EMAIL_CHANGED: ["Your account e-mail address changed", "The e-mail address of your Friendly Pay account was just changed"],
      SEC_PIN_CHANGED: ["Your PIN was changed", "The PIN of your Friendly Pay account was just changed."],
      SEC_NEW_DEVICE: ["New sign-in to your account", "A sign-in to your Friendly Pay account was detected from a new device."],
      warn: "If this wasn't you, contact our support immediately:",
    },
  },
  ar: {
    dir: "rtl", locale: "ar-OM-u-nu-latn",
    welcomeSubject: "مرحباً بك في Friendly Pay",
    welcomeTitle: (n: string) => `مرحباً بك في Friendly Pay يا ${n}!`,
    welcomeBody: "تم تأكيد حسابك. يمكنك الآن إرسال الأموال واستلامها وإدارتها بأمان مع Friendly Pay.",
    open: "فتح Friendly Pay",
    supportLine: "هل تحتاج إلى مساعدة؟ راسلنا:",
    company: "Friendly Pay خدمة من Friendly.",
    privacy: "الخصوصية", terms: "الشروط",
    sentSubject: (a: string) => `تمت العملية بنجاح: ${a}`,
    recvSubject: (a: string) => `لقد استلمت ${a}`,
    sentTitle: "تمت عمليتك بنجاح", recvTitle: "لقد استلمت أموالاً",
    f: { type: "النوع", amount: "المبلغ", to: "المستفيد", from: "المرسل", yor: "Friendly ID", phone: "الهاتف", service: "الخدمة",
      address: "عنوان الوجهة", network: "الشبكة", memo: "المذكرة",
      rate: "سعر الصرف", dest: "المبلغ المستلم", debited: "المبلغ المخصوم", received: "المبلغ المستلم",
      fee: "الرسوم", date: "التاريخ", time: "الوقت", ref: "المرجع", status: "الحالة" },
    ok: "ناجحة",
    kinds: { FIAT_TRANSFER: "تحويل عبر Friendly ID", FIAT_EXTERNAL: "تحويل دولي", CRYPTO_TRANSFER: "تحويل عملات رقمية", ADMIN_DEPOSIT: "إيداع",
      CRYPTO_BUY: "شراء عملات رقمية", CRYPTO_SELL: "بيع عملات رقمية", CRYPTO_SWAP: "مبادلة عملات رقمية", CRYPTO_SEND: "إرسال عملات رقمية خارجي", CRYPTO_TO_BANK: "من العملات الرقمية إلى البنك" },
    sec: {
      SEC_PASSWORD_CHANGED: ["تم تغيير كلمة المرور", "تم تغيير كلمة مرور حسابك في Friendly Pay للتو."],
      SEC_EMAIL_CHANGED: ["تم تغيير البريد الإلكتروني لحسابك", "تم تغيير البريد الإلكتروني لحسابك في Friendly Pay للتو"],
      SEC_PIN_CHANGED: ["تم تغيير رمز PIN", "تم تغيير رمز PIN لحسابك في Friendly Pay للتو."],
      SEC_NEW_DEVICE: ["تسجيل دخول جديد إلى حسابك", "تم رصد تسجيل دخول إلى حسابك في Friendly Pay من جهاز جديد."],
      warn: "إذا لم تكن أنت، تواصل مع الدعم فوراً:",
    },
  },
};

const FIAT_DEC: Record<string, number> = { OMR: 3, XOF: 0, USD: 2, AED: 2, SAR: 2 };
// Noms affichés des réseaux (envois crypto). Un réseau inconnu est affiché tel quel.
const NETWORK_NAMES: Record<string, string> = {
  bitcoin: "Bitcoin", ethereum: "Ethereum", bsc: "BNB Smart Chain", polygon: "Polygon", tron: "TRON", solana: "Solana", xrp: "XRP Ledger", litecoin: "Litecoin",
};
// La base garde YOR-XXXXXX et YOR-TX-… ; l'application affiche FRD-… : les e-mails aussi.
const dispId = (v: unknown) => String(v ?? "").replace(/^YOR-/i, "FRD-");
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function num(n: unknown, asset: string, lang: Lang): string {
  const dec = FIAT_DEC[asset];
  return new Intl.NumberFormat(T[lang].locale, {
    minimumFractionDigits: dec ?? 0, maximumFractionDigits: dec ?? 8,
  }).format(Number(n));
}
const money = (n: unknown, asset: string, lang: Lang) => `${num(n, asset, lang)} ${asset}`;

function layout(lang: Lang, title: string, intro: string, rows: [string, string][], extraHtml = ""): string {
  const t = T[lang];
  const al = t.dir === "rtl" ? "right" : "left";
  // Une valeur longue sans espace (adresse de portefeuille) doit passer à la ligne au lieu de déborder sur téléphone.
  const wrap = (v: string) => (v.length > 28 ? ";word-break:break-all;overflow-wrap:anywhere" : "");
  const body = rows.map(([k, v]) =>
    `<tr><td style="padding:9px 0;color:#6b7280;font-size:14px;text-align:${al};border-bottom:1px solid #eef0f4">${esc(k)}</td>` +
    `<td style="padding:9px 0;color:#111827;font-size:14px;font-weight:600;text-align:${t.dir === "rtl" ? "left" : "right"};border-bottom:1px solid #eef0f4${wrap(v)}" dir="ltr">${esc(v)}</td></tr>`).join("");
  const links = APP_URL
    ? `<a href="${esc(APP_URL)}" style="color:#6b7280">${esc(t.privacy)}</a> · <a href="${esc(APP_URL)}" style="color:#6b7280">${esc(t.terms)}</a>`
    : `${esc(t.privacy)} · ${esc(t.terms)}`;
  return `<!doctype html><html lang="${lang}" dir="${t.dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
    `<body style="margin:0;background:#f3f4f8;font-family:Arial,Helvetica,sans-serif" dir="${t.dir}">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">` +
    `<table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden" cellpadding="0" cellspacing="0">` +
    `<tr><td style="background:#0B7F75;padding:22px 28px;text-align:${al}"><span style="color:#fff;font-size:24px;font-weight:800;letter-spacing:.3px">Friendly</span>` +
    `<span style="color:#BDF2E9;font-size:24px;font-weight:600;margin:0 6px">Pay</span></td></tr>` +
    `<tr><td style="padding:28px;text-align:${al}"><h1 style="margin:0 0 12px;font-size:21px;color:#111827">${esc(title)}</h1>` +
    `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151">${esc(intro)}</p>` +
    (rows.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>` : "") +
    extraHtml + `</td></tr>` +
    `<tr><td style="padding:18px 28px;background:#f9fafb;font-size:12px;line-height:1.6;color:#6b7280;text-align:${al}">` +
    `${esc(t.supportLine)} <a href="mailto:${REPLY_TO}" style="color:#0B7F75">${REPLY_TO}</a><br>${esc(t.company)}<br>${links}</td></tr>` +
    `</table></td></tr></table></body></html>`;
}

function button(label: string): string {
  if (!APP_URL) return "";
  return `<p style="margin:24px 0 0;text-align:center"><a href="${esc(APP_URL)}" style="display:inline-block;background:#0B7F75;color:#fff;text-decoration:none;font-weight:700;padding:13px 28px;border-radius:10px;font-size:15px">${esc(label)}</a></p>`;
}

async function langOf(userId: string | null): Promise<Lang> {
  if (!userId) return "en";
  const { data } = await sb.from("user_docs").select("data").eq("user_id", userId).eq("doc_name", "preferences").maybeSingle();
  const l = data?.data?.language;
  return l === "fr" || l === "ar" || l === "en" ? l : "en";
}

const SUCCESS = ["CONFIRMED", "SUCCESS", "COMPLETED"];

// Returns null when the email must be skipped (reason in .skip)
async function build(log: Row, lang: Lang): Promise<{ subject: string; html: string } | { skip: string }> {
  const t = T[lang];
  const type: string = log.email_type;

  if (type === "WELCOME") {
    const { data: p } = await sb.from("profiles").select("first_name, welcome_email_sent_at").eq("id", log.user_id).maybeSingle();
    if (!p) return { skip: "profile_not_found" };
    if (p.welcome_email_sent_at) return { skip: "welcome_already_sent" };
    const name = (p.first_name || "").trim() || "";
    return { subject: t.welcomeSubject, html: layout(lang, t.welcomeTitle(name).replace(" ,", ","), t.welcomeBody, [], button(t.open)) };
  }

  if (type.startsWith("SEC_")) {
    const pair = t.sec[type];
    if (!pair) return { skip: "unknown_security_type" };
    const extra = `<p style="margin:20px 0 0;font-size:14px;color:#b91c1c">${esc(t.sec.warn)} <a href="mailto:${REPLY_TO}" style="color:#b91c1c">${REPLY_TO}</a></p>`;
    let intro = pair[1];
    if (type === "SEC_EMAIL_CHANGED" && log.payload?.new_email) intro += ` (${log.payload.new_email}).`;
    return { subject: pair[0], html: layout(lang, pair[0], intro, [], extra) };
  }

  if (type === "TX_SENDER" || type === "TX_RECEIVER") {
    const { data: tx } = await sb.from("transactions").select("*").eq("id", log.transaction_id).maybeSingle();
    if (!tx) return { skip: "transaction_not_found" };
    if (!SUCCESS.includes(tx.status)) return { skip: `status_${tx.status}` };
    const isSender = type === "TX_SENDER";
    const asset: string = tx.asset;

    const { data: led } = await sb.from("ledger_entries").select("asset, delta, id")
      .eq("transaction_id", tx.id).eq("user_id", log.user_id).order("id");
    let rows = (led ?? []) as Row[];
    const same = rows.filter((r) => r.asset === asset);
    if (same.length) rows = same;
    if (!rows.length) return { skip: "ledger_missing" }; // data not complete yet -> retry later
    const moved = rows.reduce((s, r) => s + Number(r.delta), 0);

    const otherId = isSender ? tx.receiver_id : tx.sender_id;
    let other: Row | null = null;
    if (otherId) {
      const { data } = await sb.from("profiles").select("first_name, last_name, yor_id").eq("id", otherId).maybeSingle();
      other = data;
    }
    const otherName = other ? ((`${other.first_name} ${other.last_name}`).trim() || dispId(other.yor_id)) : "";
    const meta: Row = tx.meta ?? {};
    const ben: Row = meta.beneficiary ?? {};
    const d = new Date(tx.created_at);
    const date = new Intl.DateTimeFormat(t.locale, { dateStyle: "long", timeZone: "UTC" }).format(d);
    const time = new Intl.DateTimeFormat(t.locale, { timeStyle: "medium", timeZone: "UTC", hourCycle: "h23" }).format(d) + " UTC";

    const out: [string, string][] = [[t.f.type, t.kinds[tx.kind] ?? tx.kind], [t.f.amount, money(tx.amount, asset, lang)]];
    if (isSender) {
      const recipient = otherName || ben.name || "";
      if (recipient) out.push([t.f.to, recipient]);
      const yor = other?.yor_id || tx.receiver_yor_id;
      if (yor) out.push([t.f.yor, dispId(yor)]);
      if (ben.phone) out.push([t.f.phone, ben.phone]);
      if (meta.provider) out.push([t.f.service, meta.provider]);
      // Envoi crypto vers une adresse : l'adresse de destination COMPLÈTE, le réseau et le mémo figurent dans l'e-mail.
      if ((tx.kind === "CRYPTO_SEND" || tx.kind === "CRYPTO_TRANSFER") && meta.address) {
        out.push([t.f.address, String(meta.address)]);
        if (tx.network) out.push([t.f.network, NETWORK_NAMES[String(tx.network).toLowerCase()] ?? String(tx.network)]);
        if (meta.memo) out.push([t.f.memo, String(meta.memo)]);
      }
      if (meta.rate && meta.destinationCurrency) {
        out.push([t.f.rate, `1 ${asset} = ${num(meta.rate, meta.destinationCurrency, lang)} ${meta.destinationCurrency}`]);
        out.push([t.f.dest, money(meta.destinationAmount, meta.destinationCurrency, lang)]);
      }
      out.push([t.f.debited, money(Math.abs(moved), asset, lang)], [t.f.fee, money(tx.fee ?? 0, asset, lang)]);
    } else {
      if (otherName) out.push([t.f.from, otherName]);
      const yor = other?.yor_id || tx.sender_yor_id;
      if (yor) out.push([t.f.yor, dispId(yor)]);
      out.push([t.f.received, money(Math.abs(moved), asset, lang)]);
    }
    out.push([t.f.date, date], [t.f.time, time], [t.f.ref, dispId(tx.reference)], [t.f.status, t.ok]);
    // NOTE: nationality is intentionally never read or rendered.
    const amt = money(isSender ? Math.abs(moved) : tx.amount, asset, lang);
    return {
      subject: isSender ? t.sentSubject(amt) : t.recvSubject(money(tx.amount, asset, lang)),
      html: layout(lang, isSender ? t.sentTitle : t.recvTitle, "", out, button(t.open)),
    };
  }
  return { skip: "unknown_email_type" };
}

const retryDelayMin = (attempts: number) => Math.min(2 ** attempts, 60);

async function process(log: Row, dryRun = false): Promise<Row> {
  const lang = await langOf(log.user_id);
  const built = await build(log, lang);

  if ("skip" in built) {
    if (dryRun) return { id: log.id, skip: built.skip };
    if (built.skip === "ledger_missing") {
      await sb.from("email_logs").update({ status: "FAILED", locked_at: null, attempts: log.attempts + 1,
        error_message: built.skip, next_attempt_at: new Date(Date.now() + retryDelayMin(log.attempts + 1) * 60000).toISOString() }).eq("id", log.id);
      return { id: log.id, status: "FAILED", error: built.skip };
    }
    await sb.from("email_logs").update({ status: "SKIPPED", locked_at: null, error_message: built.skip, recipient_language: lang }).eq("id", log.id);
    return { id: log.id, status: "SKIPPED", reason: built.skip };
  }

  const payload = {
    sender: { name: FROM_NAME, email: FROM_EMAIL },
    replyTo: { name: FROM_NAME, email: REPLY_TO },
    to: [{ email: log.recipient_email }],
    subject: built.subject,
    htmlContent: built.html,
    tags: [log.email_type],
  };
  if (dryRun) {
    return { id: log.id, lang, dir: T[lang].dir, from: payload.sender, replyTo: payload.replyTo, to: log.recipient_email,
      subject: built.subject, html: built.html };
  }

  const defer = async (msg: string, minutes: number) => {
    // configuration problem (key / unverified sender): do not burn retry attempts
    await sb.from("email_logs").update({ status: "PENDING", locked_at: null, recipient_language: lang, error_message: msg,
      next_attempt_at: new Date(Date.now() + minutes * 60000).toISOString() }).eq("id", log.id);
    return { id: log.id, status: "PENDING", error: msg };
  };
  if (!BREVO_KEY) return await defer("BREVO_API_KEY secret not configured", 5);

  let res: Response;
  try {
    res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_KEY, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    const attempts = log.attempts + 1;
    await sb.from("email_logs").update({ status: "FAILED", locked_at: null, attempts, recipient_language: lang,
      error_message: `network: ${String(e)}`.slice(0, 500), next_attempt_at: new Date(Date.now() + retryDelayMin(attempts) * 60000).toISOString() }).eq("id", log.id);
    return { id: log.id, status: "FAILED" };
  }
  const text = await res.text();
  let body: Row = {};
  try { body = JSON.parse(text); } catch { /* keep raw text */ }

  if (res.ok) {
    await sb.from("email_logs").update({ status: "SENT", locked_at: null, sent_at: new Date().toISOString(), recipient_language: lang,
      brevo_message_id: body.messageId ?? null, error_message: null, attempts: log.attempts + 1 }).eq("id", log.id);
    if (log.email_type === "WELCOME") {
      await sb.from("profiles").update({ welcome_email_sent_at: new Date().toISOString() }).eq("id", log.user_id).is("welcome_email_sent_at", null);
    }
    return { id: log.id, status: "SENT", messageId: body.messageId };
  }

  const msg = `brevo ${res.status}: ${text}`.slice(0, 500);
  if (res.status === 401 || res.status === 403 || (res.status === 400 && /sender/i.test(text))) return await defer(msg, 10);
  const attempts = log.attempts + 1;
  await sb.from("email_logs").update({ status: "FAILED", locked_at: null, attempts, recipient_language: lang, error_message: msg,
    next_attempt_at: new Date(Date.now() + retryDelayMin(attempts) * 60000).toISOString() }).eq("id", log.id);
  return { id: log.id, status: "FAILED", error: msg };
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req: Request) => {
  const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Auth: shared secret kept in the database (public.app_private), never in the frontend
  const given = req.headers.get("x-webhook-secret") ?? "";
  const { data: secret } = await sb.rpc("get_webhook_secret");
  if (!given || !secret || !safeEqual(given, String(secret))) return json({ error: "unauthorized" }, 401);

  let body: Row = {};
  try { body = await req.json(); } catch { /* empty body = sweep */ }

  if (body.dry_run && body.log_id) {
    const { data: log } = await sb.from("email_logs").select("*").eq("id", body.log_id).maybeSingle();
    if (!log) return json({ error: "not_found" }, 404);
    return json(await process(log, true));
  }

  const { data: logs, error } = await sb.rpc("claim_email_logs", { p_id: body.log_id ?? null, p_limit: 20 });
  if (error) return json({ error: error.message }, 500);
  const results: Row[] = [];
  for (const log of (logs ?? []) as Row[]) {
    try { results.push(await process(log)); }
    catch (e) {
      await sb.from("email_logs").update({ status: "FAILED", locked_at: null, attempts: log.attempts + 1, error_message: String(e).slice(0, 500),
        next_attempt_at: new Date(Date.now() + retryDelayMin(log.attempts + 1) * 60000).toISOString() }).eq("id", log.id);
      results.push({ id: log.id, status: "FAILED", error: String(e) });
    }
  }
  return json({ processed: results.length, results });
});
