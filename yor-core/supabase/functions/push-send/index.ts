import { createClient } from "npm:@supabase/supabase-js@2";
import {
  PUSH_TYPES, buildPushMessage, buildTestMessage, generateVapidKeys, normalizeLang, safeEqual, sendPush, validSub, validateSubscription,
  type Lang, type PushMessage, type Row, type VapidKeys,
} from "./lib.ts";

/* push-send : notifications push (Web Push) — iPhone (écran d'accueil, iOS 16.4+), Android, ordinateur.
   - La base APPELLE cette fonction (pg_net) dès qu'une ligne est écrite dans public.notifications (envoi, réception, dépôt) : la notification part
     même si l'application est fermée, c'est Apple (APNs) qui la livre.
   - L'application l'appelle (jeton de connexion de la personne) avec l'action « subscribe » / « unsubscribe » (Réglages → Alertes sur ce téléphone :
     enregistre ou retire SON appareil, après contrôle de l'adresse de livraison) ou « test » (bouton « Envoyer un test » : vers SES appareils seulement).
   Authentification : (1) jeton interne de la base (en-tête x-notice-token, table privée notice_dispatch_cfg, comparé à durée constante) ; ou
   (2) jeton de connexion de la personne (verify_jwt) pour subscribe / unsubscribe / test.
   Clés VAPID : générées ICI à la première utilisation et gardées dans la table privée push_vapid (RLS sans politique, aucun droit public). La clé
   privée ne quitte jamais le serveur : elle n'est ni dans l'application, ni dans un fichier, ni dans une réponse. */

const SUBJECT = Deno.env.get("PUSH_SUBJECT") ?? "https://yor-wallet.netlify.app";   /* contact VAPID : une adresse https (aucune adresse e-mail personnelle n'est envoyée à Apple) */
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-notice-token",
  "access-control-allow-methods": "POST, OPTIONS",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let vapidCache: VapidKeys | null = null;
async function vapid(): Promise<VapidKeys> {
  if (vapidCache) return vapidCache;
  let { data } = await sb.from("push_vapid").select("public_key, private_jwk").eq("id", true).maybeSingle();
  if (!data) {
    const k = await generateVapidKeys();
    await sb.from("push_vapid").upsert({ id: true, public_key: k.publicKey, private_jwk: k.privateJwk }, { onConflict: "id", ignoreDuplicates: true });
    ({ data } = await sb.from("push_vapid").select("public_key, private_jwk").eq("id", true).maybeSingle());   /* relecture : si deux appels se croisent, une seule paire reste */
  }
  if (!data) throw new Error("vapid_unavailable");
  vapidCache = { publicKey: data.public_key, privateJwk: data.private_jwk };
  return vapidCache;
}

async function langOf(userId: string): Promise<{ lang: Lang; notificationsOn: boolean }> {
  const { data } = await sb.from("user_docs").select("data").eq("user_id", userId).eq("doc_name", "preferences").maybeSingle();
  return { lang: normalizeLang(data?.data?.language), notificationsOn: data?.data?.notifications !== false };   /* le réglage « Notifications » de l'application s'applique aussi ici */
}

/* Envoie un message à tous les appareils d'une personne ; supprime les abonnements que le service de push dit disparus (404 / 410). */
async function deliver(userId: string, msg: PushMessage): Promise<Row[]> {
  const { data: subs } = await sb.from("push_subscriptions").select("id, endpoint, p256dh, auth, fail_count").eq("user_id", userId).order("updated_at", { ascending: false }).limit(10);
  const keys = await vapid();
  const out: Row[] = [];
  for (const s of (subs ?? []) as Row[]) {
    if (!validSub(s)) { await sb.from("push_subscriptions").delete().eq("id", s.id); out.push({ ok: false, status: 0, removed: true }); continue; }
    const r = await sendPush(s as never, msg, keys, SUBJECT);
    const now = new Date().toISOString();
    if (r.gone) await sb.from("push_subscriptions").delete().eq("id", s.id);
    else await sb.from("push_subscriptions").update({ last_attempt_at: now, last_status: r.status, ...(r.ok ? { last_ok_at: now, fail_count: 0 } : {}) }).eq("id", s.id);
    if (!r.ok && !r.gone) {                       /* 10 échecs de suite : l'appareil est retiré */
      if ((s.fail_count ?? 0) + 1 >= 10) await sb.from("push_subscriptions").delete().eq("id", s.id);
      else await sb.from("push_subscriptions").update({ fail_count: (s.fail_count ?? 0) + 1 }).eq("id", s.id);
    }
    out.push({ ok: r.ok, status: r.status, ...(r.gone ? { removed: true } : {}) });
  }
  return out;
}

async function notify(notificationId: string): Promise<Row> {
  const { data: n } = await sb.from("notifications").select("id, user_id, type, title, message, data, read").eq("id", notificationId).maybeSingle();
  if (!n) return { skipped: "not_found" };
  if (!(PUSH_TYPES as readonly string[]).includes(n.type)) return { skipped: "type_not_pushed" };
  const { lang, notificationsOn } = await langOf(n.user_id);
  if (!notificationsOn) return { skipped: "user_notifications_off" };
  /* au plus UN envoi par notification, même si la base appelle deux fois */
  const { error: dup } = await sb.from("push_sent").insert({ notification_id: n.id });
  if (dup && dup.code === "23505") return { skipped: "already_sent" };   /* toute autre erreur de la table de contrôle ne doit jamais empêcher la notification */
  const { count } = await sb.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", n.user_id).eq("read", false).in("type", PUSH_TYPES as never);
  const msg = buildPushMessage(n, lang, count ?? 0);
  if (!msg) return { skipped: "no_message" };
  const results = await deliver(n.user_id, msg);
  return { sent: results.filter((r) => r.ok).length, devices: results.length, results };
}

Deno.serve(async (req: Request) => {
  const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", ...CORS } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let body: Row = {};
  try { body = await req.json(); } catch { /* corps vide */ }

  try {
    const presented = req.headers.get("x-notice-token") ?? "";
    if (presented) {
      const { data: cfg } = await sb.from("notice_dispatch_cfg").select("token").eq("id", true).maybeSingle();
      if (!safeEqual(presented, cfg?.token)) return json({ error: "unauthorized" }, 401);
      if (body.action === "init") return json({ publicKey: (await vapid()).publicKey });       /* crée la paire VAPID si elle n'existe pas encore ; ne renvoie que la clé PUBLIQUE */
      const id = String(body.notification_id ?? "");
      if (!UUID.test(id)) return json({ error: "invalid_notification_id" }, 400);
      return json(await notify(id));
    }

    // Appel de l'application : on retrouve la personne par son jeton de connexion
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u, error: ue } = token ? await sb.auth.getUser(token) : { data: { user: null }, error: new Error("no token") };
    if (ue || !u?.user?.id) return json({ error: "unauthorized" }, 401);
    const uid = u.user.id;

    if (body.action === "key") return json({ publicKey: (await vapid()).publicKey });
    if (body.action === "subscribe") {
      let v;
      try { v = validateSubscription(body.subscription, body.user_agent); } catch (e) { return json({ error: String((e as Error).message) }, 400); }
      /* un appareil = un compte : si quelqu'un d'autre se connecte sur le même téléphone, l'abonnement lui est réattribué */
      const { error: ie } = await sb.from("push_subscriptions").upsert(
        { user_id: uid, endpoint: v.endpoint, p256dh: v.p256dh, auth: v.auth, user_agent: v.userAgent, updated_at: new Date().toISOString(), fail_count: 0 }, { onConflict: "endpoint" });
      if (ie) return json({ error: "save_failed" }, 500);
      /* au plus 10 appareils par personne : les plus anciens sont retirés */
      const { data: all } = await sb.from("push_subscriptions").select("id").eq("user_id", uid).order("updated_at", { ascending: false });
      const extra = ((all ?? []) as Row[]).slice(10).map((r) => r.id);
      if (extra.length) await sb.from("push_subscriptions").delete().in("id", extra);
      return json({ ok: true });
    }
    if (body.action === "unsubscribe") {
      const ep = String(body.endpoint ?? "");
      if (!ep || ep.length > 1000) return json({ error: "invalid_endpoint" }, 400);
      await sb.from("push_subscriptions").delete().eq("endpoint", ep).eq("user_id", uid);   /* seulement SON appareil */
      return json({ ok: true });
    }
    if (body.action === "test") {
      const { data: last } = await sb.from("push_subscriptions").select("last_attempt_at").eq("user_id", uid).order("last_attempt_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
      if (last?.last_attempt_at && Date.now() - new Date(last.last_attempt_at).getTime() < 5000) return json({ error: "too_fast" }, 429);   /* pas de rafale */
      const { lang } = await langOf(uid);
      const results = await deliver(uid, buildTestMessage(lang));
      return json({ devices: results.length, sent: results.filter((r) => r.ok).length, results });
    }
    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: "push_failed", detail: String((e as Error)?.message ?? e).slice(0, 200) }, 500);   /* ni clé, ni adresse d'appareil dans l'erreur */
  }
});
