// token-admin / lib.ts — logique PURE (aucune E/S, aucun import, aucun secret).
// Testee localement par tests/edge/token-admin-lib.test.mjs. Syntaxe volontairement "effacable" (pas d'enum,
// pas de proprietes de parametres) pour pouvoir etre executee telle quelle par Node 22 et par Deno.

export type Sha256 = (data: Uint8Array) => Uint8Array;
export type Check = { name: string; ok: boolean };

const HEX_RE = /^[0-9a-fA-F]*$/;

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

// ---------------------------------------------------------------------------- adresses TRON
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

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

export function hex41ToBase58(hex41: string, sha256: Sha256): string {
  if (!/^41[0-9a-fA-F]{40}$/.test(hex41)) throw new Error("bad_address");
  const payload = hexToBytes(hex41);
  const check = sha256(sha256(payload)).slice(0, 4);
  const full = new Uint8Array(25);
  full.set(payload, 0);
  full.set(check, 21);
  return base58Encode(full);
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

/** Adresse TRON publique (base58check, 34 caracteres, commence par T) -> hex41. Refuse tout ce qui n'a pas un controle valide. */
export function base58ToHex41(addr: string, sha256: Sha256): string {
  if (typeof addr !== "string" || !/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr)) throw new Error("bad_address");
  const raw = base58Decode(addr);
  if (raw.length !== 25 || raw[0] !== 0x41) throw new Error("bad_address");
  const payload = raw.slice(0, 21);
  const check = sha256(sha256(payload)).slice(0, 4);
  for (let i = 0; i < 4; i++) if (raw[21 + i] !== check[i]) throw new Error("bad_checksum");
  return bytesToHex(payload);
}

/** Mot ABI (32 octets) d'une adresse TRON : 12 octets nuls + les 20 octets de l'adresse (sans le prefixe 0x41). */
export function abiAddressWord(hex41: string): string {
  if (!/^41[0-9a-fA-F]{40}$/.test(hex41)) throw new Error("bad_address");
  return "0".repeat(24) + hex41.slice(2).toLowerCase();
}

/** Mot ABI (32 octets) d'un entier non signe. */
export function abiUintWord(n: bigint): string {
  if (typeof n !== "bigint" || n < 0n || n >= 1n << 256n) throw new Error("bad_uint");
  return n.toString(16).padStart(64, "0");
}

/** Affichage exact d'un montant en unites entieres : formatUnits(1870000000000n, 6) === "1870000.000000". */
export function formatUnits(n: bigint, decimals: number): string {
  if (typeof n !== "bigint" || n < 0n) throw new Error("bad_amount");
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw new Error("bad_decimals");
  if (decimals === 0) return n.toString();
  const base = 10n ** BigInt(decimals);
  return `${n / base}.${(n % base).toString().padStart(decimals, "0")}`;
}

// ---------------------------------------------------------------------------- ABI (lecture)
export function decodeUint(hex: string): bigint {
  if (typeof hex !== "string" || hex.length === 0 || hex.length > 64 || !HEX_RE.test(hex)) throw new Error("bad_uint");
  return BigInt("0x" + hex);
}

export function decodeAbiString(hex: string): string {
  const b = hexToBytes(hex);
  if (b.length < 64) throw new Error("abi_short");
  const off = Number(BigInt("0x" + bytesToHex(b.slice(0, 32))));
  if (!Number.isSafeInteger(off) || off + 32 > b.length) throw new Error("abi_bad_offset");
  const len = Number(BigInt("0x" + bytesToHex(b.slice(off, off + 32))));
  if (!Number.isSafeInteger(len) || off + 32 + len > b.length) throw new Error("abi_bad_length");
  return new TextDecoder().decode(b.slice(off + 32, off + 32 + len));
}

/** Message d'erreur TRON : texte ASCII encode en hexadecimal. Renvoie le texte, ou la chaine d'origine tronquee. */
export function decodeHexText(v: unknown): string {
  if (typeof v !== "string") return "";
  try {
    return new TextDecoder().decode(hexToBytes(v)).slice(0, 300);
  } catch (_e) {
    return v.slice(0, 300);
  }
}

// ---------------------------------------------------------------------------- opcodes
const FORBIDDEN: Record<number, string> = {
  0x49: "BLOBHASH", 0x4a: "BLOBBASEFEE", 0x5c: "TLOAD", 0x5d: "TSTORE", 0x5e: "MCOPY", 0x5f: "PUSH0",
};

export function scanOpcodes(code: Uint8Array): Array<{ pc: number; op: string }> {
  const hits: Array<{ pc: number; op: string }> = [];
  for (let i = 0; i < code.length; ) {
    const op = code[i];
    if (FORBIDDEN[op]) hits.push({ pc: i, op: FORBIDDEN[op] });
    i += op >= 0x60 && op <= 0x7f ? 1 + (op - 0x5f) : 1;
  }
  return hits;
}

// ---------------------------------------------------------------------------- frais (jamais inventes)
/** Plafond de frais (fee_limit) en TRX : entier decimal strict de 1 a `capTrx`. Sinon null. Il n'y a AUCUNE valeur par defaut. */
export function parseFeeLimitTrx(raw: string | null, capTrx: number): number | null {
  if (typeof raw !== "string" || !/^[1-9][0-9]{0,6}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= capTrx ? n : null;
}

/**
 * Borne BASSE indicative du cout d'un deploiement : le depot du code coute 200 unites d'energie par octet de code d'execution
 * (hors execution du constructeur, hors bande passante). Le prix de l'energie vient de la chaine (getEnergyFee).
 * Le plafond suggere = borne basse x 1,5, arrondi au TRX superieur : c'est un PLAFOND (seule l'energie consommee est facturee),
 * pas un devis. Le cout reel est lu sur le recu apres confirmation.
 */
export function suggestFeeLimit(runtimeBytes: number, energyFeeSun: number) {
  if (!Number.isInteger(runtimeBytes) || runtimeBytes <= 0) throw new Error("bad_runtime_bytes");
  if (!Number.isInteger(energyFeeSun) || energyFeeSun <= 0) throw new Error("bad_energy_fee");
  const codeDepositEnergy = 200 * runtimeBytes;
  const lowerBoundSun = codeDepositEnergy * energyFeeSun;
  const suggestedTrx = Math.ceil((lowerBoundSun * 3) / 2 / 1_000_000);
  return { codeDepositEnergy, lowerBoundSun, suggestedTrx };
}

/**
 * Plafond de frais suggere pour un APPEL de contrat, a partir de l'energie reellement consommee par une SIMULATION sur le noeud
 * (triggerconstantcontract) : ceil(1,5 x energie x prix de l'energie), en TRX, minimum 1. C'est un plafond, pas un devis.
 */
export function suggestCallFeeLimitTrx(energyUsed: number, energyFeeSun: number): number {
  if (!Number.isInteger(energyUsed) || energyUsed <= 0) throw new Error("bad_energy");
  if (!Number.isInteger(energyFeeSun) || energyFeeSun <= 0) throw new Error("bad_energy_fee");
  return Math.max(1, Math.ceil((energyUsed * energyFeeSun * 3) / 2 / 1_000_000));
}

/** Un plafond choisi par l'appelant doit couvrir au moins 1,2 x le cout simule, sinon l'appel risque OUT_OF_ENERGY (frais perdus). */
export function feeLimitCoversEstimate(feeLimitSun: number, energyUsed: number, energyFeeSun: number): { ok: boolean; minSun: number } {
  if (!Number.isInteger(feeLimitSun) || feeLimitSun <= 0) throw new Error("bad_fee_limit");
  if (!Number.isInteger(energyUsed) || energyUsed <= 0) throw new Error("bad_energy");
  if (!Number.isInteger(energyFeeSun) || energyFeeSun <= 0) throw new Error("bad_energy_fee");
  const minSun = Math.ceil((energyUsed * energyFeeSun * 6) / 5);
  return { ok: feeLimitSun >= minSun, minSun };
}

// ---------------------------------------------------------------------------- verification d'une transaction construite par le noeud
/**
 * On ne signe JAMAIS une transaction que le noeud nous renvoie sans controle. Chaque verification est independante ;
 * la transaction n'est signee que si toutes sont vraies.
 */
export function checkBuiltTx(
  a: {
    tx: any;
    ownerHex41: string;
    initWithArgsHex: string;
    feeLimitSun: number;
    consumeUserResourcePercent: number;
    originEnergyLimit: number;
  },
  sha256: Sha256,
): Check[] {
  const tx = a.tx;
  const checks: Check[] = [];
  const add = (name: string, ok: unknown) => checks.push({ name, ok: ok === true });
  const txID = typeof tx?.txID === "string" ? tx.txID.toLowerCase() : "";
  const rawHex = typeof tx?.raw_data_hex === "string" ? tx.raw_data_hex.toLowerCase() : "";
  add("txid_format", /^[0-9a-f]{64}$/.test(txID));
  add("raw_data_hex_format", rawHex.length > 0 && rawHex.length % 2 === 0 && /^[0-9a-f]+$/.test(rawHex));
  let hashOk = false;
  try {
    hashOk = bytesToHex(sha256(hexToBytes(rawHex))) === txID;
  } catch (_e) {
    hashOk = false;
  }
  add("txid_is_sha256_of_raw_data_hex", hashOk);
  const contract = tx?.raw_data?.contract;
  add("single_contract", Array.isArray(contract) && contract.length === 1);
  const c0 = Array.isArray(contract) ? contract[0] : null;
  add("type_is_create_smart_contract", c0?.type === "CreateSmartContract");
  const v = c0?.parameter?.value;
  const owner = a.ownerHex41.toLowerCase();
  add("owner_matches", typeof v?.owner_address === "string" && v.owner_address.toLowerCase() === owner);
  add("fee_limit_matches", tx?.raw_data?.fee_limit === a.feeLimitSun);
  add("raw_data_hex_contains_init_code_and_constructor_args", rawHex.includes(a.initWithArgsHex.toLowerCase()));
  add("raw_data_hex_contains_owner", rawHex.includes(owner));
  const nc = v?.new_contract;
  add("new_contract_bytecode_matches", typeof nc?.bytecode === "string" && nc.bytecode.toLowerCase() === a.initWithArgsHex.toLowerCase());
  add("consume_user_resource_percent_matches", nc?.consume_user_resource_percent === a.consumeUserResourcePercent);
  add("origin_energy_limit_matches", nc?.origin_energy_limit === a.originEnergyLimit);
  add("call_value_is_zero", (nc?.call_value ?? 0) === 0);
  add("expiration_present", Number.isInteger(tx?.raw_data?.expiration) && tx.raw_data.expiration > 0);
  add("contract_address_format", typeof tx?.contract_address === "string" && /^41[0-9a-fA-F]{40}$/.test(tx.contract_address));
  return checks;
}

// ---------------------------------------------------------------------------- appel de contrat (TriggerSmartContract)
// Re-encodage protobuf du JSON `raw_data` : on ne signe que si ce JSON, re-encode par NOS soins, redonne EXACTEMENT les octets
// `raw_data_hex` dont le txID est le sha256. Tout champ inconnu fait renoncer (null) : on prefere refuser que signer ce qu'on ne comprend pas.
const TRIGGER_TYPE_URL = "type.googleapis.com/protocol.TriggerSmartContract";
const TRIGGER_CONTRACT_TYPE = 31; // Transaction.Contract.ContractType.TriggerSmartContract

function pbVarint(value: number | bigint): number[] {
  let v = BigInt(value);
  if (v < 0n) throw new Error("bad_varint");
  const out: number[] = [];
  while (v >= 0x80n) {
    out.push(Number(v & 0x7fn) | 0x80);
    v >>= 7n;
  }
  out.push(Number(v));
  return out;
}
function pbBytes(fieldNo: number, data: Uint8Array): number[] {
  if (data.length === 0) return []; // proto3 : champ vide omis
  const out = [...pbVarint((fieldNo << 3) | 2), ...pbVarint(data.length)];
  for (const b of data) out.push(b);
  return out;
}
function pbInt(fieldNo: number, n: unknown): number[] {
  if (n === undefined || n === null) return [];
  if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 0) throw new Error("bad_int");
  return n === 0 ? [] : [...pbVarint(fieldNo << 3), ...pbVarint(n)];
}
function onlyKeys(o: any, allowed: string[]): boolean {
  return !!o && typeof o === "object" && Object.keys(o).every((k) => allowed.includes(k));
}

export function encodeTriggerRawData(raw: any): string | null {
  try {
    if (!onlyKeys(raw, ["ref_block_bytes", "ref_block_hash", "expiration", "contract", "timestamp", "fee_limit"])) return null;
    if (!Array.isArray(raw.contract) || raw.contract.length !== 1) return null;
    const c = raw.contract[0];
    if (!onlyKeys(c, ["type", "parameter"]) || c.type !== "TriggerSmartContract") return null;
    if (!onlyKeys(c.parameter, ["type_url", "value"]) || c.parameter.type_url !== TRIGGER_TYPE_URL) return null;
    const v = c.parameter.value;
    if (!onlyKeys(v, ["owner_address", "contract_address", "call_value", "data", "call_token_value", "token_id"])) return null;
    if (typeof v.owner_address !== "string" || typeof v.contract_address !== "string") return null;
    if (v.data !== undefined && typeof v.data !== "string") return null;
    const inner = [
      ...pbBytes(1, hexToBytes(v.owner_address)),
      ...pbBytes(2, hexToBytes(v.contract_address)),
      ...pbInt(3, v.call_value),
      ...pbBytes(4, hexToBytes(v.data ?? "")),
      ...pbInt(5, v.call_token_value),
      ...pbInt(6, v.token_id),
    ];
    const any = [...pbBytes(1, new TextEncoder().encode(TRIGGER_TYPE_URL)), ...pbBytes(2, new Uint8Array(inner))];
    const contract = [...pbVarint(1 << 3), ...pbVarint(TRIGGER_CONTRACT_TYPE), ...pbBytes(2, new Uint8Array(any))];
    const out = [
      ...(typeof raw.ref_block_bytes === "string" ? pbBytes(1, hexToBytes(raw.ref_block_bytes)) : []),
      ...(typeof raw.ref_block_hash === "string" ? pbBytes(4, hexToBytes(raw.ref_block_hash)) : []),
      ...pbInt(8, raw.expiration),
      ...pbBytes(11, new Uint8Array(contract)),
      ...pbInt(14, raw.timestamp),
      ...pbInt(18, raw.fee_limit),
    ];
    return bytesToHex(new Uint8Array(out));
  } catch (_e) {
    return null;
  }
}

/** Controle d'une transaction d'APPEL de contrat construite par le noeud. Signee seulement si toutes les verifications sont vraies. */
export function checkTriggerTx(
  a: { tx: any; ownerHex41: string; contractHex41: string; dataHex: string; feeLimitSun: number },
  sha256: Sha256,
): Check[] {
  const tx = a.tx;
  const checks: Check[] = [];
  const add = (name: string, ok: unknown) => checks.push({ name, ok: ok === true });
  const txID = typeof tx?.txID === "string" ? tx.txID.toLowerCase() : "";
  const rawHex = typeof tx?.raw_data_hex === "string" ? tx.raw_data_hex.toLowerCase() : "";
  add("txid_format", /^[0-9a-f]{64}$/.test(txID));
  add("raw_data_hex_format", rawHex.length > 0 && rawHex.length % 2 === 0 && /^[0-9a-f]+$/.test(rawHex));
  let hashOk = false;
  try {
    hashOk = bytesToHex(sha256(hexToBytes(rawHex))) === txID;
  } catch (_e) {
    hashOk = false;
  }
  add("txid_is_sha256_of_raw_data_hex", hashOk);
  const contract = tx?.raw_data?.contract;
  add("single_contract", Array.isArray(contract) && contract.length === 1);
  const c0 = Array.isArray(contract) ? contract[0] : null;
  add("type_is_trigger_smart_contract", c0?.type === "TriggerSmartContract");
  const v = c0?.parameter?.value;
  const owner = a.ownerHex41.toLowerCase();
  const target = a.contractHex41.toLowerCase();
  const data = a.dataHex.toLowerCase();
  add("owner_matches", typeof v?.owner_address === "string" && v.owner_address.toLowerCase() === owner);
  add("contract_address_matches", typeof v?.contract_address === "string" && v.contract_address.toLowerCase() === target);
  add("data_matches_selector_and_arguments", typeof v?.data === "string" && v.data.toLowerCase() === data);
  add("call_value_is_zero", (v?.call_value ?? 0) === 0);
  add("call_token_value_is_zero", (v?.call_token_value ?? 0) === 0);
  add("token_id_is_zero", (v?.token_id ?? 0) === 0);
  add("fee_limit_matches", tx?.raw_data?.fee_limit === a.feeLimitSun);
  add("expiration_present", Number.isInteger(tx?.raw_data?.expiration) && tx.raw_data.expiration > 0);
  add("raw_data_hex_contains_data", data.length > 0 && rawHex.includes(data));
  add("raw_data_hex_contains_owner", rawHex.includes(owner));
  add("raw_data_hex_contains_contract", rawHex.includes(target));
  add("raw_data_hex_equals_reencoded_raw_data", encodeTriggerRawData(tx?.raw_data) === rawHex);
  return checks;
}

// ---------------------------------------------------------------------------- etat d'un deploiement
export type DeployState = "broadcasted" | "confirming" | "confirmed" | "failed" | "expired";

export type Classification = {
  state: DeployState;
  blockNumber: number | null;
  solidified: boolean;
  receiptResult: string | null;
  provisionalFailure: boolean;
  contractHex41: string | null;
  anomaly: string | null;
  cost: { energyUsageTotal: number | null; energyFee: number | null; netUsage: number | null; netFee: number | null; feeSun: number | null } | null;
};

const blockOf = (x: any): number | null => (Number.isInteger(x?.blockNumber) && x.blockNumber > 0 ? x.blockNumber : null);
const resultOf = (x: any): string | null => (typeof x?.receipt?.result === "string" ? x.receipt.result : null);
const contractOf = (x: any): string | null =>
  typeof x?.contract_address === "string" && /^41[0-9a-fA-F]{40}$/.test(x.contract_address) ? x.contract_address.toLowerCase() : null;
const numOrNull = (n: unknown): number | null => (typeof n === "number" && Number.isFinite(n) ? n : null);
const costOf = (x: any) =>
  x && typeof x === "object" && x.receipt
    ? {
      energyUsageTotal: numOrNull(x.receipt.energy_usage_total),
      energyFee: numOrNull(x.receipt.energy_fee),
      netUsage: numOrNull(x.receipt.net_usage),
      netFee: numOrNull(x.receipt.net_fee),
      feeSun: numOrNull(x.fee),
    }
    : null;

/**
 * "confirmed" exige : noeud SOLIDITY (bloc solidifie), numero de bloc > 0, receipt.result === "SUCCESS" ET une adresse de contrat valide.
 * Un echec vu seulement sur le noeud complet reste provisoire ("confirming"). Une transaction introuvable reste "broadcasted"
 * jusqu'a son expiration (+60 s), puis devient "expired".
 */
export function classify(info: any, sol: any, expirationMs: number | null, nowMs: number, requireContractAddress = true): Classification {
  const solBn = blockOf(sol);
  if (solBn !== null) {
    const r = resultOf(sol);
    const addr = contractOf(sol) ?? contractOf(info);
    if (requireContractAddress && r === "SUCCESS" && addr === null) {
      return { state: "confirming", blockNumber: solBn, solidified: true, receiptResult: r, provisionalFailure: false, contractHex41: null, anomaly: "success_without_contract_address", cost: costOf(sol) };
    }
    return { state: r === "SUCCESS" ? "confirmed" : "failed", blockNumber: solBn, solidified: true, receiptResult: r, provisionalFailure: false, contractHex41: addr, anomaly: null, cost: costOf(sol) };
  }
  const fullBn = blockOf(info);
  if (fullBn !== null) {
    const r = resultOf(info);
    return { state: "confirming", blockNumber: fullBn, solidified: false, receiptResult: r, provisionalFailure: r !== "SUCCESS", contractHex41: contractOf(info), anomaly: null, cost: costOf(info) };
  }
  const expired = typeof expirationMs === "number" && nowMs > expirationMs + 60_000;
  return { state: expired ? "expired" : "broadcasted", blockNumber: null, solidified: false, receiptResult: null, provisionalFailure: false, contractHex41: null, anomaly: null, cost: null };
}

// ---------------------------------------------------------------------------- reservation ("claim") d'un deploiement
export type Claim = {
  v: 1;
  network: string;
  txid: string;
  deployer: string;
  deployerHex41: string;
  expectedContractHex41: string;
  feeLimitSun: number;
  expiration: number;
  status: "claimed" | "broadcasted" | "confirmed";
  contractHex41: string | null;
  at: string;
  // Reservations d'operations (appels de contrat) seulement : nom de l'operation, destinataire (hex41) et montant en unites entieres.
  op?: string;
  to?: string | null;
  units?: string | null;
};

export function parseClaim(raw: string): Claim | null {
  try {
    const c = JSON.parse(raw);
    if (!c || typeof c !== "object") return null;
    if (c.v !== 1) return null;
    if (typeof c.network !== "string" || !/^[a-z]+$/.test(c.network)) return null;
    if (typeof c.txid !== "string" || !/^[0-9a-f]{64}$/.test(c.txid)) return null;
    if (typeof c.deployerHex41 !== "string" || !/^41[0-9a-f]{40}$/.test(c.deployerHex41)) return null;
    if (typeof c.deployer !== "string") return null;
    if (!Number.isInteger(c.feeLimitSun) || c.feeLimitSun <= 0) return null;
    if (!Number.isInteger(c.expiration) || c.expiration <= 0) return null;
    if (!["claimed", "broadcasted", "confirmed"].includes(c.status)) return null;
    if (c.op !== undefined && (typeof c.op !== "string" || !/^[a-z_]{1,32}$/.test(c.op))) return null;
    if (c.to !== undefined && c.to !== null && (typeof c.to !== "string" || !/^41[0-9a-f]{40}$/.test(c.to))) return null;
    if (c.units !== undefined && c.units !== null && (typeof c.units !== "string" || !/^[0-9]{1,40}$/.test(c.units))) return null;
    return c as Claim;
  } catch (_e) {
    return null;
  }
}

// ---------------------------------------------------------------------------- artefact compile (cache)
// Le compilateur solc consomme presque tout le budget CPU d'une requete (limite Supabase : ~2 s). Le resultat de la compilation
// (code d'initialisation, code d'execution, ABI) est donc range une fois dans public.app_private, et chaque usage le RE-VERIFIE
// contre des empreintes epinglees dans le code (les empreintes, pas le contenu du cache, sont l'ancre de confiance).
export type Artifact = {
  v: 1;
  sourceSha256: string;
  initHex: string;
  runtimeHex: string;
  abi: Array<{ type: string; name?: string }>;
  abiSha256: string;
  warnings: number;
  warningSamples: string[];
};

export function parseArtifact(raw: string): Artifact | null {
  try {
    const a = JSON.parse(raw);
    if (!a || typeof a !== "object" || a.v !== 1) return null;
    const hex = (x: unknown) => typeof x === "string" && x.length > 0 && x.length % 2 === 0 && /^[0-9a-f]+$/.test(x);
    const h64 = (x: unknown) => typeof x === "string" && /^[0-9a-f]{64}$/.test(x);
    if (!h64(a.sourceSha256) || !h64(a.abiSha256)) return null;
    if (!hex(a.initHex) || !hex(a.runtimeHex)) return null;
    if (!Array.isArray(a.abi) || a.abi.length === 0 || a.abi.some((e: any) => !e || typeof e !== "object" || typeof e.type !== "string")) return null;
    if (!Number.isInteger(a.warnings) || a.warnings < 0) return null;
    if (!Array.isArray(a.warningSamples) || a.warningSamples.some((w: unknown) => typeof w !== "string")) return null;
    return a as Artifact;
  } catch (_e) {
    return null;
  }
}
