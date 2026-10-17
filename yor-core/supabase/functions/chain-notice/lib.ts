// chain-notice / lib.ts — logique PURE (aucune E/S, aucun secret). Testée par tests/edge/chain-notice-lib.test.mjs.
// Syntaxe volontairement « effaçable » (pas d'enum, pas de propriétés de paramètres) : exécutable telle quelle par Node 22 et par Deno.
//
// Rôle : à partir de ce que le nœud TRON (testnet Nile) répond pour un transfert du jeton YOR Experimental USDT, décider
//  - si c'est bien un transfert de CE jeton (et lequel : de qui, vers qui, combien) ;
//  - s'il est CONFIRMÉ (nœud solidity : bloc > 0, receipt SUCCESS, événement Transfer attendu) — jamais autrement ;
//  puis construire l'e-mail (EN / FR / AR). Aucun nom de banque tierce, aucune promesse que la chaîne n'a pas prouvée.

export type Sha256 = (data: Uint8Array) => Uint8Array;
export type Lang = "en" | "fr" | "ar";
export type ChainEvent = "sent" | "confirmed";

/** YOR Experimental USDT sur Nile (docs/TOKEN.md). Jeton de TEST : ce n'est pas Tether. */
export const TOKEN_ADDRESS = "TYnzmpqeUWtXWjymVtdj4SADzW45adnzdf";
export const TOKEN_DECIMALS = 6;
export const NETWORK_NAME = "Nile Testnet";
export const TRANSFER_SELECTOR = "a9059cbb";                  // transfer(address,uint256), constante ERC-20/TRC-20 publique
export const TRANSFER_TOPIC = "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"; // public-hash : Transfer(address,address,uint256)

const HEX_RE = /^[0-9a-fA-F]*$/;
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function hexToBytes(hex: string): Uint8Array {
  if (typeof hex !== "string" || hex.length % 2 !== 0 || !HEX_RE.test(hex)) throw new Error("bad_hex");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToHex(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += x.toString(16).padStart(2, "0");
  return s;
}

export function base58Encode(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = "";
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b === 0) out = "1" + out;
    else break;
  }
  return out;
}

export function base58Decode(s: string): Uint8Array {
  if (typeof s !== "string" || s.length === 0) throw new Error("bad_base58");
  let n = 0n;
  for (const ch of s) {
    const i = B58.indexOf(ch);
    if (i < 0) throw new Error("bad_base58");
    n = n * 58n + BigInt(i);
  }
  let hex = n.toString(16);
  if (hex.length % 2 !== 0) hex = "0" + hex;
  const body = n === 0n ? new Uint8Array(0) : hexToBytes(hex);
  let zeros = 0;
  for (const ch of s) {
    if (ch === "1") zeros++;
    else break;
  }
  const out = new Uint8Array(zeros + body.length);
  out.set(body, zeros);
  return out;
}

export function hex41ToBase58(hex41: string, sha256: Sha256): string {
  if (!/^41[0-9a-fA-F]{40}$/.test(hex41)) throw new Error("bad_address");
  const payload = hexToBytes(hex41);
  const check = sha256(sha256(payload)).slice(0, 4);
  const full = new Uint8Array(25);
  full.set(payload, 0);
  full.set(check, 21);
  return base58Encode(full);
}

/** Adresse TRON publique (base58check, 34 caractères, commence par T) -> hex41. Refuse tout contrôle invalide. */
export function base58ToHex41(addr: string, sha256: Sha256): string {
  if (typeof addr !== "string" || !/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr)) throw new Error("bad_address");
  const raw = base58Decode(addr);
  if (raw.length !== 25 || raw[0] !== 0x41) throw new Error("bad_address");
  const payload = raw.slice(0, 21);
  const check = sha256(sha256(payload)).slice(0, 4);
  for (let i = 0; i < 4; i++) if (raw[21 + i] !== check[i]) throw new Error("bad_checksum");
  return bytesToHex(payload);
}

/** formatUnits(1000000000n, 6) === "1000.000000" ; puis séparateur de milliers : "1,000.000000". */
export function formatAmount(raw: bigint, decimals: number = TOKEN_DECIMALS): string {
  if (typeof raw !== "bigint" || raw < 0n) throw new Error("bad_amount");
  const base = 10n ** BigInt(decimals);
  const whole = (raw / base).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${whole}.${(raw % base).toString().padStart(decimals, "0")}`;
}

export function isTxid(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-fA-F]{64}$/.test(s);
}

export function normalizeLang(v: unknown): Lang {
  const s = String(v ?? "").toLowerCase().slice(0, 2);
  return s === "fr" || s === "ar" ? s : "en";
}

export function normalizeEvent(v: unknown): ChainEvent | null {
  return v === "sent" || v === "confirmed" ? v : null;
}

// ---------------------------------------------------------------------------- lecture du transfert
export interface ParsedTransfer { fromHex41: string; toHex41: string; amountRaw: bigint }
export type Parsed = { ok: true; value: ParsedTransfer } | { ok: false; reason: string };

/** `tx` = réponse de POST /wallet/gettransactionbyid. Accepte UNIQUEMENT transfer(address,uint256) du jeton `tokenHex41`, sans valeur native. */
export function parseTransferTx(tx: any, txid: string, tokenHex41: string): Parsed {
  if (!tx || typeof tx !== "object" || typeof tx.txID !== "string") return { ok: false, reason: "tx_not_found" };
  if (tx.txID.toLowerCase() !== String(txid).toLowerCase()) return { ok: false, reason: "txid_mismatch" };
  const contracts = tx.raw_data && Array.isArray(tx.raw_data.contract) ? tx.raw_data.contract : [];
  if (contracts.length !== 1) return { ok: false, reason: "not_a_single_contract_call" };
  const c = contracts[0];
  if (!c || c.type !== "TriggerSmartContract" || !c.parameter || !c.parameter.value) return { ok: false, reason: "not_a_contract_call" };
  const v = c.parameter.value;
  const owner = String(v.owner_address ?? "").toLowerCase();
  const contract = String(v.contract_address ?? "").toLowerCase();
  const data = String(v.data ?? "").toLowerCase();
  if (!/^41[0-9a-f]{40}$/.test(owner)) return { ok: false, reason: "bad_owner" };
  if (contract !== tokenHex41.toLowerCase()) return { ok: false, reason: "not_the_yor_token" };
  if (v.call_value !== undefined && Number(v.call_value) !== 0) return { ok: false, reason: "native_value_attached" };
  if (!/^[0-9a-f]{136}$/.test(data) || data.slice(0, 8) !== TRANSFER_SELECTOR) return { ok: false, reason: "not_a_transfer" };
  const toWord = data.slice(8, 72), amountWord = data.slice(72, 136);
  if (!/^0{24}[0-9a-f]{40}$/.test(toWord)) return { ok: false, reason: "bad_recipient_word" };
  return { ok: true, value: { fromHex41: owner, toHex41: "41" + toWord.slice(24), amountRaw: BigInt("0x" + amountWord) } };
}

/** Détails annoncés par l'application pour l'e-mail « sent » : la chaîne n'est PAS attendue (juste après la diffusion, le nœud ne connaît souvent pas encore
 *  la transaction). On exige quand même des adresses TRON à somme de contrôle valide et un montant entier > 0 ; rien n'est complété ni inventé. */
export function parseSentClaim(c: any, sha256: Sha256): Parsed {
  if (!c || typeof c !== "object") return { ok: false, reason: "missing_details" };
  let fromHex41: string, toHex41: string;
  try {
    fromHex41 = base58ToHex41(String(c.from ?? ""), sha256);
    toHex41 = base58ToHex41(String(c.to ?? ""), sha256);
  } catch (_e) { return { ok: false, reason: "invalid_address" }; }
  const a = c.amount;   // texte uniquement : un nombre JSON perdrait des chiffres au-delà de 2^53
  if (typeof a !== "string" || !/^[0-9]{1,30}$/.test(a) || BigInt(a) <= 0n) return { ok: false, reason: "invalid_amount" };
  return { ok: true, value: { fromHex41, toHex41, amountRaw: BigInt(a) } };
}

export type Confirmation = { ok: true; blockNumber: number } | { ok: false; reason: string };

/** `info` = réponse de POST /walletsolidity/gettransactioninfobyid. « confirmé » = solidifié + bloc > 0 + receipt SUCCESS + événement Transfer attendu. */
export function verifyConfirmation(info: any, p: ParsedTransfer, txid: string, tokenHex41: string): Confirmation {
  if (!info || typeof info !== "object" || typeof info.id !== "string") return { ok: false, reason: "not_solidified_yet" };
  if (info.id.toLowerCase() !== String(txid).toLowerCase()) return { ok: false, reason: "txid_mismatch" };
  const bn = Number(info.blockNumber);
  if (!Number.isInteger(bn) || bn <= 0) return { ok: false, reason: "no_block" };
  const result = info.receipt && typeof info.receipt.result === "string" ? info.receipt.result : null;
  if (result !== "SUCCESS") return { ok: false, reason: result ? "receipt_" + result.toLowerCase() : "no_receipt" };
  const contract20 = tokenHex41.slice(2).toLowerCase();
  const word = (hex41: string) => "0".repeat(24) + hex41.slice(2).toLowerCase();
  const amountWord = p.amountRaw.toString(16).padStart(64, "0");
  const logs = Array.isArray(info.log) ? info.log : [];
  const found = logs.some((e: any) => e && typeof e.address === "string" && e.address.toLowerCase().replace(/^41/, "") === contract20 &&
    Array.isArray(e.topics) && e.topics.length === 3 && String(e.topics[0]).toLowerCase().replace(/^0x/, "") === TRANSFER_TOPIC &&
    String(e.topics[1]).toLowerCase().replace(/^0x/, "") === word(p.fromHex41) &&
    String(e.topics[2]).toLowerCase().replace(/^0x/, "") === word(p.toHex41) &&
    String(e.data ?? "").toLowerCase().replace(/^0x/, "") === amountWord);
  return found ? { ok: true, blockNumber: bn } : { ok: false, reason: "transfer_event_not_found" };
}

// ---------------------------------------------------------------------------- e-mail
export interface ChainEmailData {
  event: ChainEvent;
  lang: Lang;
  amountRaw: bigint;
  from: string;          // adresse TRON base58
  to: string;            // adresse TRON base58
  txid: string;
  blockNumber?: number;  // seulement pour « confirmed »
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

const T: Record<Lang, any> = {
  en: {
    dir: "ltr", brand: "Friendly Pay", token: "YOR-USDT",
    sent: { subject: (a: string) => `Transfer sent: ${a} YOR-USDT`, title: "Transfer sent to the network",
      intro: "Your transfer was signed and sent to the TRON Nile test network. It is NOT confirmed yet: you will get another e-mail when the network confirms it.",
      status: "Sent to the network, waiting for confirmation" },
    confirmed: { subject: (a: string) => `Transfer confirmed: ${a} YOR-USDT`, title: "Transfer confirmed on the network",
      intro: "The TRON Nile test network confirmed your transfer.", status: "Confirmed on the network" },
    f: { amount: "Amount", from: "From", to: "To", network: "Network", txid: "Transaction ID", status: "Status", block: "Block", explorer: "View on the explorer" },
    note: "YOR Experimental USDT is a TEST token on the Nile test network. It has no monetary value and is not Tether (USDT).",
  },
  fr: {
    dir: "ltr", brand: "Friendly Pay", token: "YOR-USDT",
    sent: { subject: (a: string) => `Transfert envoyé : ${a} YOR-USDT`, title: "Transfert envoyé au réseau",
      intro: "Votre transfert a été signé et envoyé au réseau de test TRON Nile. Il n'est PAS encore confirmé : vous recevrez un autre e-mail quand le réseau l'aura confirmé.",
      status: "Envoyé au réseau, en attente de confirmation" },
    confirmed: { subject: (a: string) => `Transfert confirmé : ${a} YOR-USDT`, title: "Transfert confirmé sur le réseau",
      intro: "Le réseau de test TRON Nile a confirmé votre transfert.", status: "Confirmé sur le réseau" },
    f: { amount: "Montant", from: "De", to: "Vers", network: "Réseau", txid: "ID de transaction", status: "Statut", block: "Bloc", explorer: "Voir sur l'explorateur" },
    note: "YOR Experimental USDT est un jeton de TEST sur le réseau de test Nile. Il n'a aucune valeur monétaire et n'est pas du Tether (USDT).",
  },
  ar: {
    dir: "rtl", brand: "Friendly Pay", token: "YOR-USDT",
    sent: { subject: (a: string) => `تم إرسال التحويل: ${a} YOR-USDT`, title: "تم إرسال التحويل إلى الشبكة",
      intro: "تم توقيع تحويلك وإرساله إلى شبكة TRON Nile التجريبية. لم يتم تأكيده بعد: ستصلك رسالة أخرى عندما تؤكده الشبكة.",
      status: "أُرسل إلى الشبكة، بانتظار التأكيد" },
    confirmed: { subject: (a: string) => `تم تأكيد التحويل: ${a} YOR-USDT`, title: "تم تأكيد التحويل على الشبكة",
      intro: "أكدت شبكة TRON Nile التجريبية تحويلك.", status: "مؤكد على الشبكة" },
    f: { amount: "المبلغ", from: "من", to: "إلى", network: "الشبكة", txid: "معرّف المعاملة", status: "الحالة", block: "الكتلة", explorer: "عرض في المستكشف" },
    note: "YOR Experimental USDT رمز تجريبي على شبكة Nile التجريبية. ليس له قيمة مالية وليس Tether (USDT).",
  },
};

export function explorerUrl(txid: string): string {
  return "https://nile.tronscan.org/#/transaction/" + txid.toLowerCase();
}

export function buildChainEmail(d: ChainEmailData): { subject: string; html: string; text: string } {
  const t = T[d.lang] ?? T.en;
  const e = t[d.event];
  const amount = formatAmount(d.amountRaw);
  const rows: Array<[string, string, boolean]> = [
    [t.f.amount, `${amount} ${t.token}`, true],
    [t.f.from, d.from, false],
    [t.f.to, d.to, false],
    [t.f.network, NETWORK_NAME, false],
    [t.f.status, e.status, false],
  ];
  if (d.event === "confirmed" && d.blockNumber) rows.push([t.f.block, String(d.blockNumber), false]);
  rows.push([t.f.txid, d.txid.toLowerCase(), false]);
  const al = t.dir === "rtl" ? "right" : "left";
  const tr = rows.map(([k, v, strong]) =>
    `<tr><td style="padding:9px 0;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;vertical-align:top">${esc(k)}</td>` +
    `<td dir="ltr" style="padding:9px 0;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;text-align:${t.dir === "rtl" ? "left" : "right"};word-break:break-all;${strong ? "font-weight:700" : ""}">${esc(v)}</td></tr>`).join("");
  const html =
    `<!doctype html><html dir="${t.dir}"><body style="margin:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">` +
    `<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">` +
    `<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden">` +
    `<tr><td style="background:#0B7F75;padding:16px 28px;color:#ffffff;font-weight:800;letter-spacing:.08em;font-size:14px;text-align:${al}">${esc(t.brand)}</td></tr>` +
    `<tr><td style="padding:28px;text-align:${al}"><h1 style="margin:0 0 12px;font-size:21px;color:#111827">${esc(e.title)}</h1>` +
    `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151">${esc(e.intro)}</p>` +
    `<table width="100%" cellpadding="0" cellspacing="0" style="text-align:${al}">${tr}</table>` +
    `<p style="margin:18px 0 0"><a href="${esc(explorerUrl(d.txid))}" style="color:#0B7F75;font-size:13px">${esc(t.f.explorer)}</a></p>` +
    `<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#6b7280">${esc(t.note)}</p>` +
    `</td></tr></table></td></tr></table></body></html>`;
  const text = [e.title, "", e.intro, "", ...rows.map(([k, v]) => `${k}: ${v}`), "", explorerUrl(d.txid), "", t.note].join("\n");
  return { subject: e.subject(amount), html, text };
}
