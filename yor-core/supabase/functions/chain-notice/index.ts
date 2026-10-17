import { createClient } from "npm:@supabase/supabase-js@2";
import { createHash } from "node:crypto";
import {
  buildChainEmail, base58ToHex41, hex41ToBase58, isTxid, normalizeEvent, normalizeLang, parseSentClaim, parseTransferTx, verifyConfirmation,
  TOKEN_ADDRESS, type ParsedTransfer, type Sha256,
} from "./lib.ts";

/* chain-notice : e-mail à la personne connectée quand SON transfert de YOR Experimental USDT part (« sent ») puis quand la chaîne le CONFIRME (« confirmed »).

   Règles (docs/NOTICES.md, section crypto) :
   - testnet Nile seulement : l'URL du nœud est écrite en dur, rien ne vient de l'appelant (pas de SSRF, pas de mainnet) ;
   - jeton YOR Experimental USDT seulement : une transaction qui n'est pas un transfer(address,uint256) de CE jeton est refusée (422) ;
   - « sent » (« c'est parti ») N'ATTEND PAS la chaîne : l'e-mail part tout de suite avec les détails annoncés par l'application (adresses TRON à somme de
     contrôle valide, montant entier > 0) ; si le nœud connaît déjà la transaction, ses valeurs font foi. L'e-mail dit qu'elle n'est PAS encore confirmée ;
   - « confirmed » exige la preuve on-chain (nœud solidity : bloc > 0, receipt SUCCESS, événement Transfer attendu), sinon 409 et AUCUN e-mail ;
   - l'e-mail part vers l'adresse de la personne connectée (jeton de connexion vérifié), jamais vers une adresse fournie ;
   - un seul e-mail par (personne, transaction, événement) ; 30 e-mails crypto par personne et par 24 h ;
   - aucune clé privée, aucune signature : la signature reste dans TronLink. */

const FROM_EMAIL = "yordigitalefinance@gmail.com";   // expéditeur officiel fixe, identique à send-notice
const FROM_NAME = (Deno.env.get("NOTICE_FROM_NAME") ?? "Friendly Pay").replace(/\b(?:YOR|NEX)(?:\s+WALLET)?\b/gi, "Friendly Pay");   // 12.9.0 : Friendly Pay (une ancienne valeur « YOR WALLET » / « NEX WALLET » du secret est corrigée)
const BREVO_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
const NODE = "https://nile.trongrid.io";
const DAILY_LIMIT = 30;

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const sha256: Sha256 = (d) => new Uint8Array(createHash("sha256").update(d).digest());
const TOKEN_HEX41 = base58ToHex41(TOKEN_ADDRESS, sha256);

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

async function node(path: string, payload: unknown, timeoutMs = 8000): Promise<any> {
  const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json" };
  const key = Deno.env.get("TRONGRID_API_KEY");
  if (key) headers["TRON-PRO-API-KEY"] = key;
  const r = await fetch(NODE + path, { method: "POST", headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) throw new Error("node_http_" + r.status);
  return await r.json();
}

Deno.serve(async (req: Request) => {
  const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // 1. qui appelle ? (le jeton est déjà vérifié par la plateforme ; on retrouve ici la personne et son e-mail)
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u, error: ue } = jwt ? await sb.auth.getUser(jwt) : { data: { user: null }, error: new Error("no token") };
  if (ue || !u?.user?.id) return json({ error: "unauthorized" }, 401);
  const uid = u.user.id;
  const email = String(u.user.email ?? "").trim();
  if (!email) return json({ error: "no_email_on_account" }, 400);

  // 2. entrée
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* corps vide */ }
  const txidRaw = body.txid;
  if (!isTxid(txidRaw)) return json({ error: "invalid_txid" }, 400);
  const event = normalizeEvent(body.event);
  if (!event) return json({ error: "invalid_event", allowed: ["sent", "confirmed"] }, 400);
  const txid = txidRaw.toLowerCase();
  const lang = normalizeLang(body.lang);

  // 3. déjà envoyé ? limite quotidienne ?
  const { data: ex } = await sb.from("chain_notices").select("id, status, created_at").eq("user_id", uid).eq("txid", txid).eq("event", event).maybeSingle();
  if (ex?.status === "SENT") return json({ ok: true, already: true });
  if (ex?.status === "SENDING" && Date.now() - Date.parse(ex.created_at) < 120_000) return json({ ok: true, inProgress: true });
  const { count } = await sb.from("chain_notices").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString());
  if ((count ?? 0) >= DAILY_LIMIT) return json({ error: "rate_limited" }, 429);

  // 4. les détails du transfert
  let value: ParsedTransfer;
  let blockNumber: number | undefined;
  if (event === "sent") {
    /* « c'est parti » : on N'ATTEND PAS la chaîne. Juste après la diffusion le nœud ne connaît souvent pas encore la transaction (ou ne répond pas) :
       dans ce cas les détails annoncés par l'application (validés) servent à l'e-mail, qui dit clairement « pas encore confirmé ».
       Si le nœud connaît DÉJÀ la transaction, ses valeurs font foi, et une transaction qui n'est pas un transfert YOR-USDT est refusée. */
    let tx: any = null;
    try { tx = await node("/wallet/gettransactionbyid", { value: txid }, 3000); } catch { /* injoignable : on n'attend pas */ }
    if (tx && typeof tx === "object" && typeof tx.txID === "string") {
      const onChain = parseTransferTx(tx, txid, TOKEN_HEX41);
      if (!onChain.ok) return json({ error: onChain.reason }, 422);
      value = onChain.value;
    } else {
      const claim = parseSentClaim({ from: body.from, to: body.to, amount: body.amount }, sha256);
      if (!claim.ok) return json({ error: claim.reason }, 400);
      value = claim.value;
    }
  } else {
    // « confirmed » : preuve on-chain OBLIGATOIRE (les détails de l'appelant sont ignorés)
    let tx: any;
    try { tx = await node("/wallet/gettransactionbyid", { value: txid }); } catch { return json({ error: "node_unreachable" }, 502); }
    const parsed = parseTransferTx(tx, txid, TOKEN_HEX41);
    if (!parsed.ok) return json({ error: parsed.reason }, parsed.reason === "tx_not_found" ? 404 : 422);
    let info: any;
    try { info = await node("/walletsolidity/gettransactioninfobyid", { value: txid }); } catch { return json({ error: "node_unreachable" }, 502); }
    const c = verifyConfirmation(info, parsed.value, txid, TOKEN_HEX41);
    if (!c.ok) return json({ error: "not_confirmed", reason: c.reason }, 409);   // aucun e-mail « confirmé » sans preuve
    value = parsed.value;
    blockNumber = c.blockNumber;
  }

  // 5. réserver la ligne (un seul envoi même si deux appels arrivent ensemble)
  if (ex) {
    const { data: claimed } = await sb.from("chain_notices").update({ status: "SENDING", error_message: null }).eq("id", ex.id).eq("status", ex.status).select("id");
    if (!claimed || claimed.length !== 1) return json({ ok: true, inProgress: true });
  } else {
    const { error: ie } = await sb.from("chain_notices").insert({ user_id: uid, txid, event, status: "SENDING" });
    if (ie) return ie.code === "23505" ? json({ ok: true, inProgress: true }) : json({ error: "storage_error" }, 500);
  }
  const mark = (patch: Record<string, unknown>) => sb.from("chain_notices").update(patch).eq("user_id", uid).eq("txid", txid).eq("event", event);

  // 6. l'e-mail (Brevo, comme send-notice)
  if (!BREVO_KEY) {
    await mark({ status: "FAILED", error_message: "provider not configured: BREVO_API_KEY secret missing" });
    return json({ error: "email_provider_not_configured" }, 503);
  }
  const mail = buildChainEmail({
    event, lang, amountRaw: value.amountRaw, txid, blockNumber,
    from: hex41ToBase58(value.fromHex41, sha256), to: hex41ToBase58(value.toHex41, sha256),
  });
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_KEY, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sender: { name: FROM_NAME, email: FROM_EMAIL }, replyTo: { name: FROM_NAME, email: FROM_EMAIL },
        to: [{ email }], subject: mail.subject, htmlContent: mail.html, textContent: mail.text, tags: ["CHAIN_NOTICE"] }),
    });
    const text = await res.text();
    let b: Record<string, unknown> = {};
    try { b = JSON.parse(text); } catch { /* texte brut */ }
    if (res.ok) {
      await mark({ status: "SENT", sent_at: new Date().toISOString(), provider_message_id: typeof b.messageId === "string" ? b.messageId : null, error_message: null });
      return json({ ok: true, event });
    }
    await mark({ status: "FAILED", error_message: `brevo ${res.status}: ${text}`.slice(0, 500) });
    return json({ error: "email_refused" }, 502);
  } catch (e) {
    await mark({ status: "FAILED", error_message: `network: ${String(e)}`.slice(0, 500) });
    return json({ error: "email_unreachable" }, 502);
  }
});
