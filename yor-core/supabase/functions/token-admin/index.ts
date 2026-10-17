// token-admin v5 — compile, DEPLOIE et fait fonctionner (TESTNET UNIQUEMENT : nile, shasta) le contrat YOR-USDT FIGE.
//
// Garanties :
//  - Le code source n'est JAMAIS fourni par l'appelant : il est relu depuis public.app_private (service_role seul) et n'est
//    utilise que si son sha256 est EXACTEMENT celui epingle ci-dessous (fichier contracts/YORExperimentalUSDT.sol du depot).
//  - Acces : JWT Supabase + secret propre (x-token-admin-secret, comparaison en temps constant). Aucune action sans les deux.
//  - Actions fermees. GET (lecture) : ping, compile, selftest, address, plan, status, callplan, opstatus.
//    POST (ecriture) : cache, keygen, deploy, grant_minter, testmint.
//  - Reseaux : nile, shasta. "mainnet" est refuse explicitement. Aucune URL n'est fournie par l'appelant.
//  - La cle de deploiement est un secret serveur GENERE ICI, stocke dans public.app_private (RLS activee, aucune politique,
//    lecture reservee au service_role). Elle n'est JAMAIS renvoyee, ni journalisee, ni incluse dans une erreur.
//  - Aucun frais invente : le plafond (fee_limit_trx) est exige de l'appelant, sans valeur par defaut ; le cout reel est lu sur le recu.
//  - La transaction construite par le noeud est verifiee (checkBuiltTx) AVANT d'etre signee ; un deploiement est reserve
//    ("claim") avant diffusion pour qu'un meme reseau ne recoive jamais deux deploiements concurrents.
//  - "confirmed" n'est annonce qu'apres solidification + receipt SUCCESS + lecture on-chain (name/symbol/decimals/hasRole).
//  - Budget CPU : solc consomme presque toute la limite d'une requete (~2 s). La compilation n'est donc faite que par `compile`
//    (GET, lecture) et `cache` (POST) ; le resultat est range dans app_private et RE-VERIFIE a chaque usage contre des empreintes
//    epinglees ci-dessous (code d'initialisation, code d'execution, ABI coherente). plan/deploy/status ne chargent jamais solc.
//  - v5 : deux appels de contrat, jamais plus. grant_minter (le deployeur, ADMIN, s'accorde MINTER_ROLE) et testmint (UN SEUL mint, du
//    "TEST BALANCE" de 1 870 000 YOR-USDT, vers une adresse publique fournie). Pas d'action generique : le montant, la fonction appelee et
//    l'echeance (0 = aucune) sont fixes dans le code. Chaque appel est SIMULE sur le noeud avant d'etre construit, la transaction est
//    re-encodee et controlee (checkTriggerTx) avant d'etre signee, puis reservee ("claim") avant diffusion. testmint refuse si
//    totalSupply() != 0 : un double mint est impossible meme si une reservation est perdue. Le solde n'est annonce qu'apres solidification
//    + receipt SUCCESS + lecture on-chain de balanceOf/totalSupply sur le noeud solidity.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { secp256k1 } from "npm:@noble/curves@1.4.2/secp256k1";
import { keccak_256 } from "npm:@noble/hashes@1.4.0/sha3";
import { sha256 as sha256Sync } from "npm:@noble/hashes@1.4.0/sha256";
import {
  abiAddressWord,
  abiUintWord,
  base58ToHex41,
  bytesToHex,
  checkBuiltTx,
  checkTriggerTx,
  classify,
  decodeAbiString,
  decodeHexText,
  decodeUint,
  feeLimitCoversEstimate,
  formatUnits,
  hex41ToBase58,
  hexToBytes,
  parseClaim,
  parseFeeLimitTrx,
  scanOpcodes,
  suggestCallFeeLimitTrx,
  suggestFeeLimit,
} from "./lib.ts";
import type { Claim, Classification } from "./lib.ts";
import { parseArtifact } from "./lib.ts";

// solc n'est charge (import dynamique) que par les deux actions qui compilent.
async function getSolc(): Promise<any> {
  const m: any = await import("npm:solc@0.8.19");
  return m.default ?? m;
}

const EXPECTED_SOURCE_SHA256 = "a8b220e3e8dfe9848800cc2c68f508cbb400b885996bf81814f144c31e9c825c"; // public-hash : empreinte publique du contrat fige
const EXPECTED_INIT_SHA256 = "f8251171419b88c1f7d7083ad87c95cd97faed8631b9af52deeee499a977f53b"; // public-hash : empreinte publique du code d'initialisation compile
const EXPECTED_RUNTIME_SHA256 = "33dae51e9a50a05dfe5b85684ff7c977ad6724a78a71382a2a19a7d66a17e6cf"; // public-hash : empreinte publique du code d'execution compile
const ARTIFACT_KEY = "yor_artifact_v1";
const SOURCE_NAME = "YORExperimentalUSDT.sol";
const CONTRACT_NAME = "YORExperimentalUSDT";
const PART_KEYS = ["yor_src_1", "yor_src_2", "yor_src_3", "yor_src_4", "yor_src_5"];
const KEY_NAME = "deployer_testnet_key";
const NETWORKS: Record<string, string> = { nile: "https://nile.trongrid.io", shasta: "https://api.shasta.trongrid.io" };
const ONCHAIN = { name: "YOR Experimental USDT", symbol: "YOR-USDT", decimals: 6 };
// Parametres de creation de contrat (pas des frais) : les appelants du jeton paient leur propre energie ; plafond d'origine exige > 0 par le noeud.
const CREATE_PARAMS = { consume_user_resource_percent: 100, origin_energy_limit: 10_000_000 };
const SUN_PER_TRX = 1_000_000;
const HARD_CAP_FEE_LIMIT_TRX = 5000;
// Appels de contrat : plafond de securite plus bas qu'un deploiement (un mint coute de l'ordre de dizaines de TRX de test, pas des milliers).
const OP_FEE_CAP_TRX = 500;
const OPS = ["grant_minter", "testmint"];
// "TEST BALANCE" : 1 870 000 YOR-USDT (6 decimales), UN SEUL mint, sans echeance. Valeur fixee ici : l'appelant ne choisit jamais le montant.
const TEST_BALANCE_TOKENS = 1_870_000n;
const TEST_BALANCE_UNITS = TEST_BALANCE_TOKENS * 1_000_000n;
const ZERO_ADDRESS_HEX41 = "41" + "00".repeat(20);
const ZERO_ROLE_HEX = "00".repeat(32);
const SIG_GRANT = "grantRole(bytes32,address)";
const SIG_MINT = "mint(address,uint256,uint64)";

const SETTINGS = {
  optimizer: { enabled: true, runs: 200 },
  evmVersion: "istanbul",
  metadata: { appendCBOR: false, bytecodeHash: "none" },
  outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] } },
};

const GET_ACTIONS = ["ping", "compile", "selftest", "address", "plan", "status", "callplan", "opstatus"];
const POST_ACTIONS = ["cache", "keygen", "deploy", "grant_minter", "testmint"];

// ---------------------------------------------------------------------------- erreurs et reponses
class Fail extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super("fail");
    this.status = status;
    this.body = body;
  }
}
class TronError extends Error {
  code: string;
  detail: string;
  constructor(code: string, detail: string) {
    super(code);
    this.code = code;
    this.detail = detail;
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const sha256 = (b: Uint8Array) => sha256Sync(b);

async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToHex(new Uint8Array(digest));
}

async function safeEqual(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

// ---------------------------------------------------------------------------- cle et adresses
function addressFromPriv(priv: Uint8Array): { hex41: string; base58: string } {
  const pub = secp256k1.getPublicKey(priv, false); // 65 octets, 0x04 || X || Y
  const h = keccak_256(pub.slice(1));
  const raw = new Uint8Array(21);
  raw[0] = 0x41;
  raw.set(h.slice(12), 1);
  const hex41 = bytesToHex(raw);
  return { hex41, base58: hex41ToBase58(hex41, sha256) };
}

/** Signature TRON : r(32) || s(32) || recId(1 octet, 0 ou 1), en hexadecimal, sur le txID (sha256 de raw_data). */
function signHash(priv: Uint8Array, hash32: Uint8Array): string {
  if (hash32.length !== 32) throw new Fail(500, { error: "bad_hash_length" });
  const sig = secp256k1.sign(hash32, priv);
  if (sig.recovery !== 0 && sig.recovery !== 1) throw new Fail(500, { error: "sign_recovery_unsupported" });
  return sig.r.toString(16).padStart(64, "0") + sig.s.toString(16).padStart(64, "0") + sig.recovery.toString(16).padStart(2, "0");
}

function predictContractHex41(txIdHex: string, ownerHex41: string): string {
  const combined = new Uint8Array(32 + 21);
  combined.set(hexToBytes(txIdHex), 0);
  combined.set(hexToBytes(ownerHex41), 32);
  const h = keccak_256(combined);
  const raw = new Uint8Array(21);
  raw[0] = 0x41;
  raw.set(h.slice(12), 1);
  return bytesToHex(raw);
}

// ---------------------------------------------------------------------------- base de donnees (service_role)
function dbEnv() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Fail(503, { error: "not_configured" });
  return { url, key };
}
const dbHeaders = (key: string, extra: Record<string, string> = {}) => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
  "content-type": "application/json",
  ...extra,
});

async function dbGet(keys: string[]): Promise<Record<string, string>> {
  const { url, key } = dbEnv();
  const res = await fetch(`${url}/rest/v1/app_private?select=key,value&key=in.(${keys.join(",")})`, { headers: dbHeaders(key) });
  if (!res.ok) throw new Fail(503, { error: "db_" + res.status });
  const rows = (await res.json()) as Array<{ key: string; value: string }>;
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

/** Insere seulement si la cle n'existe pas. Renvoie true si la ligne a ete creee. */
async function dbInsertIgnore(k: string, value: string): Promise<boolean> {
  const { url, key } = dbEnv();
  const res = await fetch(`${url}/rest/v1/app_private?on_conflict=key`, {
    method: "POST",
    headers: dbHeaders(key, { Prefer: "resolution=ignore-duplicates,return=representation" }),
    body: JSON.stringify([{ key: k, value }]),
  });
  if (!res.ok) throw new Fail(503, { error: "db_" + res.status });
  const rows = (await res.json()) as unknown[];
  return Array.isArray(rows) && rows.length === 1;
}

/** Cree ou remplace la ligne. */
async function dbUpsert(k: string, value: string): Promise<void> {
  const { url, key } = dbEnv();
  const res = await fetch(`${url}/rest/v1/app_private?on_conflict=key`, {
    method: "POST",
    headers: dbHeaders(key, { Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify([{ key: k, value }]),
  });
  if (!res.ok) throw new Fail(503, { error: "db_" + res.status });
}

/** Compare-and-swap : remplace la valeur seulement si elle est encore `oldValue`. */
async function dbSwap(k: string, oldValue: string, newValue: string): Promise<boolean> {
  const { url, key } = dbEnv();
  const res = await fetch(`${url}/rest/v1/app_private?key=eq.${encodeURIComponent(k)}&value=eq.${encodeURIComponent(oldValue)}`, {
    method: "PATCH",
    headers: dbHeaders(key, { Prefer: "return=representation" }),
    body: JSON.stringify({ value: newValue }),
  });
  if (!res.ok) throw new Fail(503, { error: "db_" + res.status });
  const rows = (await res.json()) as unknown[];
  return Array.isArray(rows) && rows.length === 1;
}

async function dbDelete(k: string, ifValue: string): Promise<void> {
  const { url, key } = dbEnv();
  await fetch(`${url}/rest/v1/app_private?key=eq.${encodeURIComponent(k)}&value=eq.${encodeURIComponent(ifValue)}`, {
    method: "DELETE",
    headers: dbHeaders(key),
  });
}

// ---------------------------------------------------------------------------- TRON (testnet)
async function tronPost(net: string, path: string, body: unknown): Promise<any> {
  if (!Object.hasOwn(NETWORKS, net)) throw new TronError("network_not_allowed", net);
  const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json" };
  const apiKey = Deno.env.get("TRONGRID_API_KEY");
  if (apiKey) headers["TRON-PRO-API-KEY"] = apiKey;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(NETWORKS[net] + path, { method: "POST", headers, body: JSON.stringify(body ?? {}), signal: ctrl.signal });
    const text = await res.text();
    if (!res.ok) throw new TronError("http_" + res.status, text.slice(0, 200));
    try {
      return JSON.parse(text);
    } catch (_e) {
      throw new TronError("bad_json", text.slice(0, 200));
    }
  } catch (e) {
    if (e instanceof TronError) throw e;
    const err = e as Error;
    throw new TronError(err?.name === "AbortError" ? "timeout" : "network", String(err?.message ?? e).slice(0, 200));
  } finally {
    clearTimeout(timer);
  }
}

async function chainParams(net: string): Promise<Record<string, number>> {
  const r = await tronPost(net, "/wallet/getchainparameters", {});
  const m: Record<string, number> = {};
  for (const p of r?.chainParameter ?? []) if (typeof p?.key === "string" && typeof p?.value === "number") m[p.key] = p.value;
  return m;
}

async function accountInfo(net: string, hex41: string) {
  const r = await tronPost(net, "/wallet/getaccount", { address: hex41, visible: false });
  const activated = !!r && typeof r === "object" && Object.keys(r).length > 0;
  return { activated, balanceSun: Number(r?.balance ?? 0) };
}

// ---------------------------------------------------------------------------- source et compilation (epinglees)
type Compiled = {
  sourceSha256: string;
  abi: Array<{ type: string; name?: string }>;
  initHex: string;
  runtimeHex: string;
  initBytes: number;
  runtimeBytes: number;
  runtimeSha256: string;
  initSha256: string;
  abiSha256: string;
  solcVersion: string | null;
  forbidden: Array<{ pc: number; op: string; where: string }>;
  warnings: number;
  warningSamples: string[];
  elapsedMs: number;
};

async function loadSource(rows: Record<string, string>): Promise<{ source: string; sourceSha256: string }> {
  const parts = PART_KEYS.map((k) => rows[k]);
  if (parts.some((p) => typeof p !== "string")) throw new Fail(500, { error: "source_incomplete" });
  const source = parts.join("");
  const sourceSha256 = await sha256Hex(source);
  if (sourceSha256 !== EXPECTED_SOURCE_SHA256) throw new Fail(500, { error: "source_hash_mismatch", got: sourceSha256, expected: EXPECTED_SOURCE_SHA256 });
  return { source, sourceSha256 };
}

async function compileFresh(rows: Record<string, string>): Promise<Compiled> {
  const { source, sourceSha256 } = await loadSource(rows);
  const solc = await getSolc();
  const t0 = performance.now();
  const input = { language: "Solidity", sources: { [SOURCE_NAME]: { content: source } }, settings: SETTINGS };
  let out: any;
  try {
    out = JSON.parse(solc.compile(JSON.stringify(input)));
  } catch (e) {
    throw new Fail(500, { error: "compiler_crashed", detail: String((e as Error)?.message ?? e).slice(0, 300) });
  }
  const diagnostics = (out.errors ?? []) as Array<{ severity: string; formattedMessage?: string; message?: string }>;
  const short = (d: { formattedMessage?: string; message?: string }) => String(d.formattedMessage ?? d.message ?? "").slice(0, 700);
  const errors = diagnostics.filter((d) => d.severity === "error");
  const warnings = diagnostics.filter((d) => d.severity === "warning");
  const contract = out.contracts?.[SOURCE_NAME]?.[CONTRACT_NAME];
  if (errors.length > 0 || !contract) {
    throw new Fail(200, { ok: false, solc: solc.version(), sourceSha256, errors: errors.slice(0, 10).map(short), warnings: warnings.length });
  }
  const runtimeHex: string = contract.evm.deployedBytecode.object;
  const initHex: string = contract.evm.bytecode.object;
  const runtime = hexToBytes(runtimeHex);
  const init = hexToBytes(initHex);
  const runtimeSha256 = await sha256Hex(runtime);
  const initSha256 = await sha256Hex(init);
  // Determinisme : meme source + memes reglages => memes octets. Tout ecart est refuse.
  if (initSha256 !== EXPECTED_INIT_SHA256 || runtimeSha256 !== EXPECTED_RUNTIME_SHA256) {
    throw new Fail(500, { error: "compile_output_mismatch", initSha256, runtimeSha256 });
  }
  return {
    sourceSha256,
    abi: contract.abi,
    initHex,
    runtimeHex,
    initBytes: init.length,
    runtimeBytes: runtime.length,
    runtimeSha256,
    initSha256,
    abiSha256: await sha256Hex(JSON.stringify(contract.abi)),
    solcVersion: String(solc.version()),
    forbidden: [
      ...scanOpcodes(runtime).map((h) => ({ ...h, where: "runtime" })),
      ...scanOpcodes(init).map((h) => ({ ...h, where: "init" })),
    ],
    warnings: warnings.length,
    warningSamples: warnings.slice(0, 5).map(short),
    elapsedMs: Math.round(performance.now() - t0),
  };
}

/** Relit l'artefact compile depuis app_private et le RE-VERIFIE contre les empreintes epinglees dans ce fichier. Aucun chargement de solc. */
async function loadArtifact(rows: Record<string, string>): Promise<Compiled> {
  const raw = rows[ARTIFACT_KEY];
  if (!raw) throw new Fail(409, { error: "artifact_missing", hint: "POST ?action=cache" });
  const a = parseArtifact(raw);
  if (!a) throw new Fail(500, { error: "artifact_unreadable" });
  if (a.sourceSha256 !== EXPECTED_SOURCE_SHA256) throw new Fail(500, { error: "artifact_source_mismatch" });
  const init = hexToBytes(a.initHex);
  const runtime = hexToBytes(a.runtimeHex);
  const initSha256 = await sha256Hex(init);
  const runtimeSha256 = await sha256Hex(runtime);
  if (initSha256 !== EXPECTED_INIT_SHA256 || runtimeSha256 !== EXPECTED_RUNTIME_SHA256) {
    throw new Fail(500, { error: "artifact_hash_mismatch", initSha256, runtimeSha256 });
  }
  if ((await sha256Hex(JSON.stringify(a.abi))) !== a.abiSha256) throw new Fail(500, { error: "artifact_abi_mismatch" });
  return {
    sourceSha256: a.sourceSha256,
    abi: a.abi,
    initHex: a.initHex,
    runtimeHex: a.runtimeHex,
    initBytes: init.length,
    runtimeBytes: runtime.length,
    runtimeSha256,
    initSha256,
    abiSha256: a.abiSha256,
    solcVersion: null,
    forbidden: [
      ...scanOpcodes(runtime).map((h) => ({ ...h, where: "runtime" })),
      ...scanOpcodes(init).map((h) => ({ ...h, where: "init" })),
    ],
    warnings: a.warnings,
    warningSamples: a.warningSamples,
    elapsedMs: 0,
  };
}

// ---------------------------------------------------------------------------- cle de deploiement
function parsePriv(hex: string | undefined): Uint8Array | null {
  if (typeof hex !== "string" || !/^[0-9a-f]{64}$/.test(hex)) return null;
  const priv = hexToBytes(hex);
  return secp256k1.utils.isValidPrivateKey(priv) ? priv : null;
}

function requirePriv(rows: Record<string, string>): Uint8Array {
  const priv = parsePriv(rows[KEY_NAME]);
  if (!priv) throw new Fail(409, { error: "no_deployer_key", hint: "POST ?action=keygen" });
  return priv;
}

// ---------------------------------------------------------------------------- construction + controle de la transaction de deploiement
async function buildDeployTx(net: string, feeLimitSun: number, ownerHex41: string, c: Compiled) {
  const initWithArgsHex = c.initHex + abiAddressWord(ownerHex41); // constructor(address admin) : admin = deployeur
  const tx = await tronPost(net, "/wallet/deploycontract", {
    owner_address: ownerHex41,
    abi: JSON.stringify(c.abi),
    bytecode: initWithArgsHex,
    name: CONTRACT_NAME,
    fee_limit: feeLimitSun,
    call_value: 0,
    consume_user_resource_percent: CREATE_PARAMS.consume_user_resource_percent,
    origin_energy_limit: CREATE_PARAMS.origin_energy_limit,
    visible: false,
  });
  if (!tx || typeof tx !== "object" || typeof tx.txID !== "string") {
    throw new Fail(502, { error: "build_rejected", detail: JSON.stringify(tx ?? null).slice(0, 400) });
  }
  const checks = checkBuiltTx(
    {
      tx,
      ownerHex41,
      initWithArgsHex,
      feeLimitSun,
      consumeUserResourcePercent: CREATE_PARAMS.consume_user_resource_percent,
      originEnergyLimit: CREATE_PARAMS.origin_energy_limit,
    },
    sha256,
  );
  if (checks.some((k) => !k.ok)) throw new Fail(502, { error: "built_tx_mismatch", failed: checks.filter((k) => !k.ok).map((k) => k.name), checks });
  const predicted = predictContractHex41(tx.txID.toLowerCase(), ownerHex41);
  return {
    tx,
    checks,
    // Information, non bloquante : l'adresse que NOTRE calcul predit pour le contrat, comparee a celle annoncee par le noeud.
    predictedContractMatchesNode: predicted === String(tx.contract_address).toLowerCase(),
  };
}

// ---------------------------------------------------------------------------- etat d'un deploiement reserve
async function currentClass(net: string, claim: Claim, requireContractAddress = true): Promise<Classification> {
  const info = await tronPost(net, "/wallet/gettransactioninfobyid", { value: claim.txid });
  const sol = await tronPost(net, "/walletsolidity/gettransactioninfobyid", { value: claim.txid });
  return classify(info, sol, claim.expiration, Date.now(), requireContractAddress);
}

async function verifyDeployed(net: string, contractHex41: string, ownerHex41: string, c: Compiled) {
  const call = async (selector: string, parameter = ""): Promise<string> => {
    const r = await tronPost(net, "/wallet/triggerconstantcontract", {
      owner_address: ownerHex41,
      contract_address: contractHex41,
      function_selector: selector,
      parameter,
      visible: false,
    });
    if (r?.result?.result !== true) throw new Fail(502, { error: "constant_call_failed", selector, detail: JSON.stringify(r?.result ?? r ?? null).slice(0, 200) });
    const out = r?.constant_result?.[0];
    if (typeof out !== "string") throw new Fail(502, { error: "constant_call_empty", selector });
    return out;
  };
  const name = decodeAbiString(await call("name()"));
  const symbol = decodeAbiString(await call("symbol()"));
  const decimals = Number(decodeUint(await call("decimals()")));
  const totalSupplyRaw = decodeUint(await call("totalSupply()")).toString();
  const adminHasRole = decodeUint(await call("hasRole(bytes32,address)", "00".repeat(32) + abiAddressWord(ownerHex41))) === 1n;
  let runtime: { fetchedBytes: number; sha256: string; matchesCompiled: boolean } | null = null;
  try {
    const info = await tronPost(net, "/wallet/getcontractinfo", { value: contractHex41, visible: false });
    const rc = info?.runtimecode;
    if (typeof rc === "string" && rc.length > 0) {
      runtime = { fetchedBytes: rc.length / 2, sha256: await sha256Hex(hexToBytes(rc)), matchesCompiled: rc.toLowerCase() === c.runtimeHex.toLowerCase() };
    }
  } catch (_e) {
    runtime = null;
  }
  return {
    name,
    symbol,
    decimals,
    totalSupplyRaw,
    adminHasDefaultAdminRole: adminHasRole,
    runtimeCode: runtime,
    identityOk: name === ONCHAIN.name && symbol === ONCHAIN.symbol && decimals === ONCHAIN.decimals && totalSupplyRaw === "0" && adminHasRole,
  };
}

// ---------------------------------------------------------------------------- parametres
function parseNetwork(u: URL): string {
  const n = (u.searchParams.get("network") ?? "nile").toLowerCase();
  if (n === "mainnet") throw new Fail(400, { error: "mainnet_refused" });
  if (!Object.hasOwn(NETWORKS, n)) throw new Fail(400, { error: "unknown_network", allowed: Object.keys(NETWORKS) });
  return n;
}

// ---------------------------------------------------------------------------- actions
/** Empreinte sha256 des fichiers TELS QUE DEPLOYES (si le runtime autorise leur lecture) : comparable a `sha256sum` du depot. */
async function selfHashes(): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const f of ["index.ts", "lib.ts"]) {
    try {
      out[f] = await sha256Hex(await Deno.readFile(new URL("./" + f, import.meta.url)));
    } catch (_e) {
      out[f] = null;
    }
  }
  return out;
}

async function handlePing(): Promise<Response> {
  const rows = await dbGet([...PART_KEYS, ARTIFACT_KEY]);
  const { source, sourceSha256 } = await loadSource(rows);
  let artifact: { ok: boolean; error?: string } = { ok: false };
  try {
    await loadArtifact(rows);
    artifact = { ok: true };
  } catch (e) {
    artifact = { ok: false, error: e instanceof Fail ? String((e.body as { error?: string }).error) : "unknown" };
  }
  return json(200, { ok: true, version: 5, sourceSha256, sourceBytes: new TextEncoder().encode(source).length, artifact, selfHash: await selfHashes() });
}

async function handleCompile(): Promise<Response> {
  const c = await compileFresh(await dbGet(PART_KEYS));
  return json(200, {
    ok: true,
    solc: c.solcVersion,
    settings: { evmVersion: SETTINGS.evmVersion, optimizerRuns: SETTINGS.optimizer.runs, appendCBOR: false },
    sourceSha256: c.sourceSha256,
    runtimeBytes: c.runtimeBytes,
    initBytes: c.initBytes,
    runtimeSha256: c.runtimeSha256,
    initSha256: c.initSha256,
    abiSha256: c.abiSha256,
    sizeLimitOk: c.runtimeBytes <= 24576,
    forbiddenOpcodes: c.forbidden,
    warnings: c.warnings,
    warningSamples: c.warningSamples,
    abiFunctions: c.abi.filter((x) => x.type === "function").map((x) => x.name).sort(),
    abiEvents: c.abi.filter((x) => x.type === "event").map((x) => x.name).sort(),
    elapsedMs: c.elapsedMs,
  });
}

/** Compile (solc, une seule action lourde) puis range l'artefact dans app_private. Les empreintes epinglees decident de sa validite. */
async function handleCache(): Promise<Response> {
  const c = await compileFresh(await dbGet(PART_KEYS));
  if (c.runtimeBytes > 24576 || c.forbidden.length > 0) throw new Fail(500, { error: "contract_not_deployable", runtimeBytes: c.runtimeBytes, forbidden: c.forbidden });
  const artifact = {
    v: 1,
    sourceSha256: c.sourceSha256,
    initHex: c.initHex,
    runtimeHex: c.runtimeHex,
    abi: c.abi,
    abiSha256: c.abiSha256,
    warnings: c.warnings,
    warningSamples: c.warningSamples,
  };
  await dbUpsert(ARTIFACT_KEY, JSON.stringify(artifact));
  const check = await loadArtifact(await dbGet([ARTIFACT_KEY])); // relecture et re-verification de ce qui est reellement stocke
  return json(200, {
    ok: true,
    cached: true,
    initSha256: check.initSha256,
    runtimeSha256: check.runtimeSha256,
    abiSha256: check.abiSha256,
    runtimeBytes: check.runtimeBytes,
    warnings: check.warnings,
    compileMs: c.elapsedMs,
  });
}

/** Vecteurs connus : aucune cle, aucune base, aucun reseau. Prouve que keccak/secp256k1/base58/signature fonctionnent dans CE runtime. */
function handleSelftest(): Response {
  const checks: Array<{ name: string; ok: boolean }> = [];
  const add = (name: string, ok: boolean) => checks.push({ name, ok });
  add("keccak256('') connu", bytesToHex(keccak_256(new Uint8Array())) === "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"); // public-hash : vecteur de test connu
  const k1 = new Uint8Array(32);
  k1[31] = 1;
  const pub1 = secp256k1.getPublicKey(k1, false);
  add("cle privee 1 -> adresse Ethereum connue", bytesToHex(keccak_256(pub1.slice(1)).slice(12)) === "7e5f4552091a69125d5dfcb7b8c2659029395bdf");
  add("base58check : vecteur USDT mainnet connu", hex41ToBase58("41a614f803b6fd780986a42c78ec9c7f77e6ded13c", sha256) === "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t");
  add("cle privee 1 -> adresse TRON", addressFromPriv(k1).base58 === "TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC");
  const hash = sha256(new TextEncoder().encode("yor selftest"));
  const sigHex = signHash(k1, hash);
  add("signature : 65 octets (130 hex)", sigHex.length === 130);
  add("signature : identifiant de recuperation 0 ou 1", sigHex.endsWith("00") || sigHex.endsWith("01"));
  const sig = secp256k1.sign(hash, k1);
  add("signature : la cle publique recuperee est la bonne", bytesToHex(sig.recoverPublicKey(hash).toRawBytes(false)) === bytesToHex(pub1));
  add("signature : verifiable", secp256k1.verify(sig, hash, secp256k1.getPublicKey(k1, true)));
  add("signature : deterministe (RFC 6979)", signHash(k1, hash) === sigHex);
  add("mot ABI d'adresse", abiAddressWord("41a614f803b6fd780986a42c78ec9c7f77e6ded13c") === "000000000000000000000000a614f803b6fd780986a42c78ec9c7f77e6ded13c"); // public-hash : vecteur de test connu
  return json(200, { ok: checks.every((k) => k.ok), checks });
}

async function handleKeygen(): Promise<Response> {
  let rows = await dbGet([KEY_NAME]);
  let created = false;
  if (!rows[KEY_NAME]) {
    const fresh = secp256k1.utils.randomPrivateKey();
    created = await dbInsertIgnore(KEY_NAME, bytesToHex(fresh));
    fresh.fill(0);
    rows = await dbGet([KEY_NAME]); // la valeur de la base fait foi (course possible entre deux appels)
  }
  const priv = requirePriv(rows);
  try {
    const a = addressFromPriv(priv);
    return json(200, {
      ok: true,
      created,
      address: a.base58,
      hex41: a.hex41,
      storage: "public.app_private (RLS, aucune politique, service_role seul)",
      note: "La cle privee n'est jamais renvoyee. Cette adresse ne sert qu'aux testnets (Nile, Shasta) : financez-la avec des TRX de TEST uniquement.",
    });
  } finally {
    priv.fill(0);
  }
}

async function handleAddress(u: URL): Promise<Response> {
  const net = u.searchParams.has("network") ? parseNetwork(u) : null; // valide AVANT toute lecture (mainnet refuse meme sans cle)
  const rows = await dbGet([KEY_NAME]);
  const priv = parsePriv(rows[KEY_NAME]);
  if (!priv) return json(200, { ok: true, exists: false });
  try {
    const a = addressFromPriv(priv);
    const body: Record<string, unknown> = { ok: true, exists: true, address: a.base58, hex41: a.hex41 };
    if (net) {
      const acct = await accountInfo(net, a.hex41);
      body.network = net;
      body.activated = acct.activated;
      body.balanceSun = acct.balanceSun;
      body.balanceTrx = acct.balanceSun / SUN_PER_TRX;
    }
    return json(200, body);
  } finally {
    priv.fill(0);
  }
}

async function handlePlan(u: URL): Promise<Response> {
  const net = parseNetwork(u);
  const claimKey = `yor_deploy_${net}`;
  const rows = await dbGet([ARTIFACT_KEY, KEY_NAME, claimKey]);
  const c = await loadArtifact(rows);
  const params = await chainParams(net);
  const energyFee = params["getEnergyFee"];
  if (!Number.isInteger(energyFee) || energyFee <= 0) throw new Fail(502, { error: "chain_param_missing", param: "getEnergyFee" });
  const est = suggestFeeLimit(c.runtimeBytes, energyFee);
  const suggestedTrx = Math.min(est.suggestedTrx, HARD_CAP_FEE_LIMIT_TRX);
  const body: Record<string, unknown> = {
    ok: true,
    network: net,
    contract: {
      name: CONTRACT_NAME,
      runtimeBytes: c.runtimeBytes,
      initBytes: c.initBytes,
      sizeLimitOk: c.runtimeBytes <= 24576,
      forbiddenOpcodes: c.forbidden.length,
      runtimeSha256: c.runtimeSha256,
    },
    chain: { energyFeeSun: energyFee, maxFeeLimitSun: params["getMaxFeeLimit"] ?? null, transactionFeeSunPerByte: params["getTransactionFee"] ?? null },
    estimate: {
      kind: "BORNE BASSE indicative, pas un devis",
      codeDepositEnergy: est.codeDepositEnergy,
      lowerBoundTrx: est.lowerBoundSun / SUN_PER_TRX,
      excludes: ["execution du constructeur", "bande passante de la transaction"],
      suggestedFeeLimitTrx: suggestedTrx,
      suggestedFeeLimitBasis: "ceil(1,5 x 200 energie x octets de code x getEnergyFee) ; c'est un PLAFOND (seule l'energie consommee est facturee)",
      suggestedExceedsHardCap: est.suggestedTrx > HARD_CAP_FEE_LIMIT_TRX,
      hardCapTrx: HARD_CAP_FEE_LIMIT_TRX,
    },
    claim: null as unknown,
    deployer: null as unknown,
    buildCheck: { skipped: "no_deployer_key" } as unknown,
  };
  if (rows[claimKey]) {
    const claim = parseClaim(rows[claimKey]);
    body.claim = claim ? { status: claim.status, txid: claim.txid, contractHex41: claim.contractHex41 } : { unreadable: true };
  }
  const priv = parsePriv(rows[KEY_NAME]);
  if (priv) {
    try {
      const me = addressFromPriv(priv);
      const acct = await accountInfo(net, me.hex41);
      body.deployer = { address: me.base58, activated: acct.activated, balanceTrx: acct.balanceSun / SUN_PER_TRX };
      // Construction a blanc : on demande au vrai noeud de construire la transaction et on la controle. Rien n'est signe ni diffuse.
      try {
        const built = await buildDeployTx(net, suggestedTrx * SUN_PER_TRX, me.hex41, c);
        body.buildCheck = { ok: true, checks: built.checks.length, allPassed: built.checks.every((k) => k.ok), predictedContractMatchesNode: built.predictedContractMatchesNode, signed: false, broadcast: false };
      } catch (e) {
        if (e instanceof Fail) body.buildCheck = { ok: false, ...(e.body as object) };
        else if (e instanceof TronError) body.buildCheck = { ok: false, error: e.code, detail: e.detail };
        else throw e;
      }
    } finally {
      priv.fill(0);
    }
  }
  return json(200, body);
}

async function handleStatus(u: URL): Promise<Response> {
  const net = parseNetwork(u);
  const claimKey = `yor_deploy_${net}`;
  const rows = await dbGet([claimKey]);
  if (!rows[claimKey]) throw new Fail(404, { error: "no_deployment", network: net });
  const claim = parseClaim(rows[claimKey]);
  if (!claim) throw new Fail(409, { error: "claim_unreadable" });
  const cls = await currentClass(net, claim);
  let verification: unknown = null;
  let contractBase58: string | null = null;
  if (cls.contractHex41) contractBase58 = hex41ToBase58(cls.contractHex41, sha256);
  if (cls.state === "confirmed" && cls.contractHex41) {
    const c = await loadArtifact(await dbGet([ARTIFACT_KEY]));
    verification = await verifyDeployed(net, cls.contractHex41, claim.deployerHex41, c);
    if (claim.status !== "confirmed") {
      await dbSwap(claimKey, rows[claimKey], JSON.stringify({ ...claim, status: "confirmed", contractHex41: cls.contractHex41 }));
    }
  }
  return json(200, {
    ok: true,
    network: net,
    txid: claim.txid,
    state: cls.state,
    blockNumber: cls.blockNumber,
    solidified: cls.solidified,
    receiptResult: cls.receiptResult,
    provisionalFailure: cls.provisionalFailure,
    anomaly: cls.anomaly,
    contractAddress: contractBase58,
    contractHex41: cls.contractHex41,
    costReal: cls.cost,
    verification,
    note: cls.state === "confirmed"
      ? "Confirme : transaction solidifiee, receipt SUCCESS. Voir verification pour la lecture on-chain."
      : "Pas confirme. Un transfert ou un deploiement n'est 'confirmed' qu'apres solidification et receipt SUCCESS.",
  });
}

async function handleDeploy(u: URL): Promise<Response> {
  const net = parseNetwork(u);
  const feeLimitTrx = parseFeeLimitTrx(u.searchParams.get("fee_limit_trx"), HARD_CAP_FEE_LIMIT_TRX);
  if (feeLimitTrx === null) {
    throw new Fail(400, { error: "fee_limit_trx_required", hint: `entier de 1 a ${HARD_CAP_FEE_LIMIT_TRX} (aucune valeur par defaut) ; voir action=plan` });
  }
  const feeLimitSun = feeLimitTrx * SUN_PER_TRX;
  const claimKey = `yor_deploy_${net}`;
  const rows = await dbGet([ARTIFACT_KEY, KEY_NAME, claimKey]);
  const priv = requirePriv(rows);
  try {
    const me = addressFromPriv(priv);

    const existingRaw = rows[claimKey] ?? null;
    if (existingRaw) {
      const prev = parseClaim(existingRaw);
      if (!prev) throw new Fail(409, { error: "claim_unreadable" });
      const prevCls = await currentClass(net, prev);
      if (prevCls.state === "confirmed") {
        throw new Fail(409, { error: "already_deployed", txid: prev.txid, contractAddress: prevCls.contractHex41 ? hex41ToBase58(prevCls.contractHex41, sha256) : null });
      }
      if (prevCls.state === "broadcasted" || prevCls.state === "confirming") {
        throw new Fail(409, { error: "deploy_in_progress", state: prevCls.state, txid: prev.txid, hint: "action=status" });
      }
      // etat "failed" ou "expired" : un nouvel essai est permis.
    }

    const c = await loadArtifact(rows);
    if (c.runtimeBytes > 24576 || c.forbidden.length > 0) throw new Fail(500, { error: "contract_not_deployable", runtimeBytes: c.runtimeBytes, forbidden: c.forbidden });

    const params = await chainParams(net);
    const maxFee = params["getMaxFeeLimit"];
    if (Number.isInteger(maxFee) && feeLimitSun > maxFee) throw new Fail(400, { error: "fee_limit_above_chain_max", maxFeeLimitSun: maxFee });

    const acct = await accountInfo(net, me.hex41);
    if (!acct.activated) throw new Fail(402, { error: "deployer_not_activated", address: me.base58, hint: "financez l'adresse avec des TRX de test" });
    if (acct.balanceSun < feeLimitSun) {
      throw new Fail(402, { error: "insufficient_balance", address: me.base58, balanceTrx: acct.balanceSun / SUN_PER_TRX, feeLimitTrx });
    }

    const built = await buildDeployTx(net, feeLimitSun, me.hex41, c);
    const txID: string = built.tx.txID.toLowerCase();
    const signature = signHash(priv, hexToBytes(txID));

    const claim: Claim = {
      v: 1,
      network: net,
      txid: txID,
      deployer: me.base58,
      deployerHex41: me.hex41,
      expectedContractHex41: String(built.tx.contract_address).toLowerCase(),
      feeLimitSun,
      expiration: built.tx.raw_data.expiration,
      status: "claimed",
      contractHex41: null,
      at: new Date().toISOString(),
    };
    const claimRaw = JSON.stringify(claim);
    const claimed = existingRaw ? await dbSwap(claimKey, existingRaw, claimRaw) : await dbInsertIgnore(claimKey, claimRaw);
    if (!claimed) throw new Fail(409, { error: "claim_conflict" });

    let b: any;
    try {
      b = await tronPost(net, "/wallet/broadcasttransaction", { ...built.tx, signature: [signature] });
    } catch (e) {
      // Issue inconnue : la transaction a peut-etre ete acceptee. On garde la reservation ; action=status tranche.
      const te = e as TronError;
      return json(202, { ok: false, state: "broadcast_unknown", txid: txID, error: te?.code ?? "unknown", hint: "action=status pour verifier sur la chaine" });
    }
    const expectedAddress = hex41ToBase58(claim.expectedContractHex41, sha256);
    if (b?.result === true || b?.code === "DUP_TRANSACTION_ERROR") {
      await dbSwap(claimKey, claimRaw, JSON.stringify({ ...claim, status: "broadcasted" }));
      return json(200, {
        ok: true,
        state: "broadcasted",
        network: net,
        txid: txID,
        deployer: me.base58,
        expectedContractAddress: expectedAddress,
        feeLimitTrx,
        note: "Diffuse, PAS confirme. Adresse du contrat non validee tant que action=status ne renvoie pas confirmed.",
      });
    }
    // Rejet explicite par le noeud : rien n'est sur la chaine, on libere la reservation.
    if (existingRaw) await dbSwap(claimKey, claimRaw, existingRaw);
    else await dbDelete(claimKey, claimRaw);
    return json(502, { error: "broadcast_rejected", code: typeof b?.code === "string" ? b.code : "UNKNOWN", message: decodeHexText(b?.message) });
  } finally {
    priv.fill(0);
  }
}

// ---------------------------------------------------------------------------- appels de contrat (grant_minter, testmint)
type Token = { contractHex41: string; contractBase58: string };
type Me = { hex41: string; base58: string };

const utf8 = (s: string) => new TextEncoder().encode(s);
const selectorHex = (sig: string) => bytesToHex(keccak_256(utf8(sig)).slice(0, 4));
const MINTER_ROLE_HEX = bytesToHex(keccak_256(utf8("MINTER_ROLE")));
const deployClaimKey = (net: string) => `yor_deploy_${net}`;
const opClaimKey = (net: string, op: string) => `yor_op_${net}_${op}`;

/** Lecture / simulation (aucune ecriture, aucune signature). `solidity` : meme appel sur le noeud solidity (etat solidifie). */
async function constCall(net: string, ownerHex41: string, contractHex41: string, sig: string, paramHex: string, solidity = false): Promise<{ out: string; energyUsed: number | null }> {
  const path = solidity ? "/walletsolidity/triggerconstantcontract" : "/wallet/triggerconstantcontract";
  const r = await tronPost(net, path, { owner_address: ownerHex41, contract_address: contractHex41, function_selector: sig, parameter: paramHex, visible: false });
  const code = r?.result?.code;
  const contractRet = r?.transaction?.ret?.[0]?.contractRet;
  if (r?.result?.result !== true || (typeof code === "string" && code !== "SUCCESS") || (typeof contractRet === "string" && contractRet !== "SUCCESS")) {
    throw new Fail(502, {
      error: "constant_call_failed",
      selector: sig,
      code: typeof code === "string" ? code : null,
      contractRet: typeof contractRet === "string" ? contractRet : null,
      detail: decodeHexText(r?.result?.message),
    });
  }
  const out = r?.constant_result?.[0];
  if (typeof out !== "string") throw new Fail(502, { error: "constant_call_empty", selector: sig });
  return { out, energyUsed: Number.isInteger(r?.energy_used) ? r.energy_used : null };
}

/** Lecture preferant le noeud solidity ; repli sur le noeud complet, TOUJOURS signale par `source`. */
async function solidRead(net: string, from: string, token: string, sig: string, paramHex: string): Promise<{ out: string; source: "solidity" | "fullnode" }> {
  try {
    return { out: (await constCall(net, from, token, sig, paramHex, true)).out, source: "solidity" };
  } catch (_e) {
    return { out: (await constCall(net, from, token, sig, paramHex, false)).out, source: "fullnode" };
  }
}

async function holdsRole(net: string, from: string, token: string, roleHex: string, who: string, solidity: boolean): Promise<boolean> {
  const r = await constCall(net, from, token, "hasRole(bytes32,address)", roleHex + abiAddressWord(who), solidity);
  return decodeUint(r.out) === 1n;
}

/** Controle de coherence : le hash MINTER_ROLE calcule ici est bien celui que le contrat deploye expose. */
async function assertRoleHash(net: string, from: string, token: string): Promise<void> {
  const r = await constCall(net, from, token, "MINTER_ROLE()", "");
  if (r.out.toLowerCase() !== MINTER_ROLE_HEX) throw new Fail(500, { error: "minter_role_hash_mismatch" });
}

function parseTronAddress(s: string | null): string {
  if (!s) throw new Fail(400, { error: "to_required", hint: "adresse publique du reseau de test (34 caracteres, commence par T)" });
  try {
    return base58ToHex41(s.trim(), sha256);
  } catch (e) {
    throw new Fail(400, { error: "bad_to_address", reason: String((e as Error)?.message ?? e).slice(0, 40) });
  }
}

/** Le jeton doit etre deploye ET confirme (solidifie + SUCCESS) : l'adresse du contrat vient de la reservation de deploiement, jamais de l'appelant. */
async function loadDeployedToken(net: string, rows: Record<string, string>): Promise<Token> {
  const raw = rows[deployClaimKey(net)];
  if (!raw) throw new Fail(409, { error: "token_not_deployed", network: net });
  const claim = parseClaim(raw);
  if (!claim) throw new Fail(409, { error: "claim_unreadable" });
  const cls = await currentClass(net, claim);
  if (cls.state !== "confirmed" || !cls.contractHex41) throw new Fail(409, { error: "token_not_confirmed", state: cls.state });
  return { contractHex41: cls.contractHex41, contractBase58: hex41ToBase58(cls.contractHex41, sha256) };
}

/** Construit l'appel via le noeud, puis le controle (checkTriggerTx : 17 verifications) AVANT toute signature. */
async function buildCallTx(net: string, ownerHex41: string, contractHex41: string, sig: string, paramHex: string, feeLimitSun: number) {
  const dataHex = selectorHex(sig) + paramHex;
  const r = await tronPost(net, "/wallet/triggersmartcontract", {
    owner_address: ownerHex41,
    contract_address: contractHex41,
    function_selector: sig,
    parameter: paramHex,
    fee_limit: feeLimitSun,
    call_value: 0,
    visible: false,
  });
  const tx = r?.transaction;
  if (r?.result?.result !== true || !tx || typeof tx !== "object" || typeof tx.txID !== "string") {
    throw new Fail(502, { error: "build_rejected", detail: JSON.stringify(r?.result ?? r ?? null).slice(0, 400) });
  }
  const checks = checkTriggerTx({ tx, ownerHex41, contractHex41, dataHex, feeLimitSun }, sha256);
  if (checks.some((k) => !k.ok)) {
    throw new Fail(502, {
      error: "built_tx_mismatch",
      failed: checks.filter((k) => !k.ok).map((k) => k.name),
      rawDataHex: typeof tx.raw_data_hex === "string" ? tx.raw_data_hex.slice(0, 4000) : null,
    });
  }
  return { tx, checks, dataHex };
}

/** Une operation deja reservee : confirmee => refus ; en cours => refus ; echouee ou expiree => nouvel essai permis (renvoie la reservation a remplacer). */
async function existingOpGate(net: string, raw: string | null): Promise<string | null> {
  if (!raw) return null;
  const prev = parseClaim(raw);
  if (!prev) throw new Fail(409, { error: "claim_unreadable" });
  const cls = await currentClass(net, prev, false);
  if (cls.state === "confirmed") throw new Fail(409, { error: "already_done", txid: prev.txid, hint: "action=opstatus" });
  if (cls.state === "broadcasted" || cls.state === "confirming") {
    throw new Fail(409, { error: "operation_in_progress", state: cls.state, txid: prev.txid, hint: "action=opstatus" });
  }
  return raw;
}

type SubmitArgs = {
  net: string;
  op: string;
  priv: Uint8Array;
  me: Me;
  token: Token;
  sig: string;
  paramHex: string;
  feeLimitTrx: number;
  claimKey: string;
  existingRaw: string | null;
  toHex41: string | null;
  units: bigint | null;
};

/** Chemin commun des deux operations : garde-fous, simulation, construction + controle, signature, reservation, diffusion. */
async function submitOp(a: SubmitArgs): Promise<Response> {
  const feeLimitSun = a.feeLimitTrx * SUN_PER_TRX;
  const params = await chainParams(a.net);
  const maxFee = params["getMaxFeeLimit"];
  if (Number.isInteger(maxFee) && feeLimitSun > maxFee) throw new Fail(400, { error: "fee_limit_above_chain_max", maxFeeLimitSun: maxFee });
  const energyFee = params["getEnergyFee"];
  if (!Number.isInteger(energyFee) || energyFee <= 0) throw new Fail(502, { error: "chain_param_missing", param: "getEnergyFee" });

  const acct = await accountInfo(a.net, a.me.hex41);
  if (!acct.activated) throw new Fail(402, { error: "deployer_not_activated", address: a.me.base58 });
  if (acct.balanceSun < feeLimitSun) {
    throw new Fail(402, { error: "insufficient_balance", address: a.me.base58, balanceTrx: acct.balanceSun / SUN_PER_TRX, feeLimitTrx: a.feeLimitTrx });
  }

  // Simulation sur le vrai noeud : si l'appel echoue (role manquant, adresse nulle...), rien n'est construit ni signe.
  const sim = await constCall(a.net, a.me.hex41, a.token.contractHex41, a.sig, a.paramHex, false);
  if (sim.energyUsed === null || sim.energyUsed <= 0) throw new Fail(502, { error: "simulation_without_energy" });
  const cover = feeLimitCoversEstimate(feeLimitSun, sim.energyUsed, energyFee);
  if (!cover.ok) {
    throw new Fail(400, {
      error: "fee_limit_too_low",
      feeLimitTrx: a.feeLimitTrx,
      simulatedEnergy: sim.energyUsed,
      energyFeeSun: energyFee,
      minimumTrx: Math.ceil(cover.minSun / SUN_PER_TRX),
      hint: "action=callplan",
    });
  }

  const built = await buildCallTx(a.net, a.me.hex41, a.token.contractHex41, a.sig, a.paramHex, feeLimitSun);
  const txID: string = built.tx.txID.toLowerCase();
  const signature = signHash(a.priv, hexToBytes(txID));

  const claim: Claim = {
    v: 1,
    network: a.net,
    txid: txID,
    deployer: a.me.base58,
    deployerHex41: a.me.hex41,
    expectedContractHex41: a.token.contractHex41,
    feeLimitSun,
    expiration: built.tx.raw_data.expiration,
    status: "claimed",
    contractHex41: null,
    at: new Date().toISOString(),
    op: a.op,
    to: a.toHex41,
    units: a.units === null ? null : a.units.toString(),
  };
  const claimRaw = JSON.stringify(claim);
  const claimed = a.existingRaw ? await dbSwap(a.claimKey, a.existingRaw, claimRaw) : await dbInsertIgnore(a.claimKey, claimRaw);
  if (!claimed) throw new Fail(409, { error: "claim_conflict" });

  let b: any;
  try {
    b = await tronPost(a.net, "/wallet/broadcasttransaction", { ...built.tx, signature: [signature] });
  } catch (e) {
    // Issue inconnue : la transaction a peut-etre ete acceptee. On garde la reservation ; opstatus tranche.
    const te = e as TronError;
    return json(202, { ok: false, state: "broadcast_unknown", op: a.op, txid: txID, error: te?.code ?? "unknown", hint: "action=opstatus pour verifier sur la chaine" });
  }
  if (b?.result === true || b?.code === "DUP_TRANSACTION_ERROR") {
    await dbSwap(a.claimKey, claimRaw, JSON.stringify({ ...claim, status: "broadcasted" }));
    return json(200, {
      ok: true,
      state: "broadcasted",
      op: a.op,
      network: a.net,
      txid: txID,
      from: a.me.base58,
      contract: a.token.contractBase58,
      to: a.toHex41 ? hex41ToBase58(a.toHex41, sha256) : null,
      feeLimitTrx: a.feeLimitTrx,
      simulatedEnergy: sim.energyUsed,
      note: "Diffuse, PAS confirme. Le resultat n'est valide que lorsque action=opstatus renvoie confirmed (solidification + receipt SUCCESS + lecture on-chain).",
    });
  }
  // Rejet explicite par le noeud : rien n'est sur la chaine, on libere la reservation.
  if (a.existingRaw) await dbSwap(a.claimKey, claimRaw, a.existingRaw);
  else await dbDelete(a.claimKey, claimRaw);
  return json(502, { error: "broadcast_rejected", code: typeof b?.code === "string" ? b.code : "UNKNOWN", message: decodeHexText(b?.message) });
}

function requireOpFeeLimit(u: URL): number {
  const feeLimitTrx = parseFeeLimitTrx(u.searchParams.get("fee_limit_trx"), OP_FEE_CAP_TRX);
  if (feeLimitTrx === null) {
    throw new Fail(400, { error: "fee_limit_trx_required", hint: `entier de 1 a ${OP_FEE_CAP_TRX} (aucune valeur par defaut) ; voir action=callplan` });
  }
  return feeLimitTrx;
}

async function handleGrantMinter(u: URL): Promise<Response> {
  const net = parseNetwork(u);
  const feeLimitTrx = requireOpFeeLimit(u);
  const claimKey = opClaimKey(net, "grant_minter");
  const rows = await dbGet([KEY_NAME, deployClaimKey(net), claimKey]);
  const priv = requirePriv(rows);
  try {
    const me = addressFromPriv(priv);
    const token = await loadDeployedToken(net, rows);
    const existingRaw = await existingOpGate(net, rows[claimKey] ?? null);
    await assertRoleHash(net, me.hex41, token.contractHex41);
    if (!(await holdsRole(net, me.hex41, token.contractHex41, ZERO_ROLE_HEX, me.hex41, false))) {
      throw new Fail(403, { error: "deployer_is_not_admin", address: me.base58 });
    }
    if (await holdsRole(net, me.hex41, token.contractHex41, MINTER_ROLE_HEX, me.hex41, false)) {
      return json(200, { ok: true, already: true, op: "grant_minter", note: "Le deployeur a deja MINTER_ROLE (lu on-chain) : rien a diffuser." });
    }
    return await submitOp({
      net,
      op: "grant_minter",
      priv,
      me,
      token,
      sig: SIG_GRANT,
      paramHex: MINTER_ROLE_HEX + abiAddressWord(me.hex41),
      feeLimitTrx,
      claimKey,
      existingRaw,
      toHex41: null,
      units: null,
    });
  } finally {
    priv.fill(0);
  }
}

/** MINTER_ROLE confirme : lecture sur le noeud solidity ; si ce noeud ne repond pas, repli sur la reservation grant_minter CONFIRMEE. */
async function minterConfirmed(net: string, me: Me, token: Token, grantRaw: string | null): Promise<{ ok: boolean; source: string }> {
  try {
    return { ok: await holdsRole(net, me.hex41, token.contractHex41, MINTER_ROLE_HEX, me.hex41, true), source: "solidity" };
  } catch (_e) {
    const claim = grantRaw ? parseClaim(grantRaw) : null;
    if (!claim) return { ok: false, source: "no_solidity_read_and_no_grant_claim" };
    const cls = await currentClass(net, claim, false);
    return { ok: cls.state === "confirmed", source: "grant_minter_claim" };
  }
}

async function handleTestMint(u: URL): Promise<Response> {
  const net = parseNetwork(u);
  const toHex41 = parseTronAddress(u.searchParams.get("to"));
  const feeLimitTrx = requireOpFeeLimit(u);
  const claimKey = opClaimKey(net, "testmint");
  const grantKey = opClaimKey(net, "grant_minter");
  const rows = await dbGet([KEY_NAME, deployClaimKey(net), claimKey, grantKey]);
  const priv = requirePriv(rows);
  try {
    const me = addressFromPriv(priv);
    const token = await loadDeployedToken(net, rows);
    if (toHex41 === token.contractHex41) throw new Fail(400, { error: "to_is_token_contract", hint: "les jetons envoyes au contrat seraient bloques" });
    if (toHex41 === ZERO_ADDRESS_HEX41) throw new Fail(400, { error: "to_is_zero_address" });
    const existingRaw = await existingOpGate(net, rows[claimKey] ?? null);
    await assertRoleHash(net, me.hex41, token.contractHex41);
    const minter = await minterConfirmed(net, me, token, rows[grantKey] ?? null);
    if (!minter.ok) throw new Fail(409, { error: "minter_role_not_confirmed", source: minter.source, hint: "POST action=grant_minter, puis attendre action=opstatus&op=grant_minter = confirmed" });
    // Verrou anti double mint, independant des reservations : le TEST BALANCE ne se cree qu'une fois, sur un jeton dont l'offre est nulle.
    const supply = decodeUint((await constCall(net, me.hex41, token.contractHex41, "totalSupply()", "")).out);
    if (supply !== 0n) throw new Fail(409, { error: "supply_not_zero", totalSupplyRaw: supply.toString(), hint: "le TEST BALANCE existe deja ou une emission a eu lieu" });
    return await submitOp({
      net,
      op: "testmint",
      priv,
      me,
      token,
      sig: SIG_MINT,
      paramHex: abiAddressWord(toHex41) + abiUintWord(TEST_BALANCE_UNITS) + abiUintWord(0n), // expiresAt = 0 : sans echeance
      feeLimitTrx,
      claimKey,
      existingRaw,
      toHex41,
      units: TEST_BALANCE_UNITS,
    });
  } finally {
    priv.fill(0);
  }
}

/** Simulation + construction A BLANC d'un appel : rien n'est signe ni diffuse. Renvoie le cout simule et le resultat des 17 controles. */
async function dryStep(net: string, me: string, tokenHex: string, sig: string, paramHex: string, energyFee: number): Promise<Record<string, unknown>> {
  try {
    const sim = await constCall(net, me, tokenHex, sig, paramHex, false);
    if (sim.energyUsed === null || sim.energyUsed <= 0) return { ok: false, error: "simulation_without_energy" };
    const suggested = suggestCallFeeLimitTrx(sim.energyUsed, energyFee);
    const feeTrx = Math.min(suggested, OP_FEE_CAP_TRX);
    const built = await buildCallTx(net, me, tokenHex, sig, paramHex, feeTrx * SUN_PER_TRX);
    return {
      ok: true,
      simulatedEnergy: sim.energyUsed,
      simulatedCostTrx: (sim.energyUsed * energyFee) / SUN_PER_TRX,
      suggestedFeeLimitTrx: suggested,
      suggestedExceedsCap: suggested > OP_FEE_CAP_TRX,
      capTrx: OP_FEE_CAP_TRX,
      basis: "ceil(1,5 x energie simulee x getEnergyFee) ; PLAFOND, seule l'energie consommee est facturee",
      buildChecks: { count: built.checks.length, allPassed: built.checks.every((k) => k.ok) },
      signed: false,
      broadcast: false,
    };
  } catch (e) {
    if (e instanceof Fail) return { ok: false, ...(e.body as object) };
    if (e instanceof TronError) return { ok: false, error: "tron_" + e.code, detail: e.detail };
    throw e;
  }
}

async function handleCallPlan(u: URL): Promise<Response> {
  const net = parseNetwork(u);
  const toParam = u.searchParams.get("to");
  const toHex41 = toParam ? parseTronAddress(toParam) : null;
  const grantKey = opClaimKey(net, "grant_minter");
  const mintKey = opClaimKey(net, "testmint");
  const rows = await dbGet([KEY_NAME, deployClaimKey(net), grantKey, mintKey]);
  const priv = requirePriv(rows);
  try {
    const me = addressFromPriv(priv);
    const token = await loadDeployedToken(net, rows);
    const params = await chainParams(net);
    const energyFee = params["getEnergyFee"];
    if (!Number.isInteger(energyFee) || energyFee <= 0) throw new Fail(502, { error: "chain_param_missing", param: "getEnergyFee" });
    const acct = await accountInfo(net, me.hex41);
    await assertRoleHash(net, me.hex41, token.contractHex41);
    const isAdmin = await holdsRole(net, me.hex41, token.contractHex41, ZERO_ROLE_HEX, me.hex41, false);
    const minterFull = await holdsRole(net, me.hex41, token.contractHex41, MINTER_ROLE_HEX, me.hex41, false);
    const minter = await minterConfirmed(net, me, token, rows[grantKey] ?? null);
    const supply = decodeUint((await constCall(net, me.hex41, token.contractHex41, "totalSupply()", "")).out);

    const steps: Record<string, unknown> = {};
    steps.grant_minter = minterFull
      ? { skipped: "deployer_already_has_minter_role" }
      : isAdmin
      ? await dryStep(net, me.hex41, token.contractHex41, SIG_GRANT, MINTER_ROLE_HEX + abiAddressWord(me.hex41), energyFee)
      : { skipped: "deployer_is_not_admin" };
    const simTo = toHex41 ?? me.hex41; // destinataire fictif pour la simulation seulement : meme chemin de code (nouveau lot)
    steps.testmint = minterFull
      ? await dryStep(net, me.hex41, token.contractHex41, SIG_MINT, abiAddressWord(simTo) + abiUintWord(TEST_BALANCE_UNITS) + abiUintWord(0n), energyFee)
      : { skipped: "minter_role_missing : la simulation du mint n'est possible qu'apres grant_minter confirme" };

    const claimSummary = (raw: string | undefined) => {
      if (!raw) return null;
      const c = parseClaim(raw);
      return c ? { status: c.status, txid: c.txid } : { unreadable: true };
    };
    return json(200, {
      ok: true,
      network: net,
      token: { address: token.contractBase58, symbol: ONCHAIN.symbol, decimals: ONCHAIN.decimals },
      deployer: { address: me.base58, activated: acct.activated, balanceTrx: acct.balanceSun / SUN_PER_TRX },
      roles: {
        minterRoleHashMatchesChain: true,
        deployerIsAdmin: isAdmin,
        deployerHasMinterRoleFullnode: minterFull,
        deployerHasMinterRoleConfirmed: minter.ok,
        confirmedSource: minter.source,
      },
      totalSupplyRaw: supply.toString(),
      chain: { energyFeeSun: energyFee, maxFeeLimitSun: params["getMaxFeeLimit"] ?? null },
      testBalance: { label: "TEST BALANCE", tokens: TEST_BALANCE_TOKENS.toString(), unitsRaw: TEST_BALANCE_UNITS.toString(), expiresAt: 0, oneShot: true },
      recipient: toHex41 ? { address: hex41ToBase58(toHex41, sha256), simulatedWith: "to" } : { simulatedWith: "deployer_address_as_stand_in" },
      steps,
      claims: { grant_minter: claimSummary(rows[grantKey]), testmint: claimSummary(rows[mintKey]) },
    });
  } finally {
    priv.fill(0);
  }
}

async function handleOpStatus(u: URL): Promise<Response> {
  const net = parseNetwork(u);
  const op = u.searchParams.get("op") ?? "";
  if (!OPS.includes(op)) throw new Fail(400, { error: "unknown_op", allowed: OPS });
  const claimKey = opClaimKey(net, op);
  const rows = await dbGet([claimKey, deployClaimKey(net)]);
  if (!rows[claimKey]) throw new Fail(404, { error: "no_operation", network: net, op });
  const claim = parseClaim(rows[claimKey]);
  if (!claim || claim.op !== op) throw new Fail(409, { error: "claim_unreadable" });
  const cls = await currentClass(net, claim, false);
  const body: Record<string, unknown> = {
    ok: true,
    network: net,
    op,
    txid: claim.txid,
    state: cls.state,
    blockNumber: cls.blockNumber,
    solidified: cls.solidified,
    receiptResult: cls.receiptResult,
    provisionalFailure: cls.provisionalFailure,
    anomaly: cls.anomaly,
    costReal: cls.cost,
    verification: null as unknown,
  };
  if (cls.state !== "confirmed") {
    body.note = cls.state === "failed"
      ? "ECHEC solidifie : la transaction a ete executee et a echoue (voir receiptResult). Rien n'a ete cree."
      : "Pas confirme. Une operation n'est 'confirmed' qu'apres solidification et receipt SUCCESS, puis lecture on-chain.";
    return json(200, body);
  }
  const token = await loadDeployedToken(net, rows);
  const from = claim.deployerHex41; // appelant des lectures : adresse PUBLIQUE du deployeur, aucune cle necessaire
  let ok = false;
  if (op === "grant_minter") {
    const r = await solidRead(net, from, token.contractHex41, "hasRole(bytes32,address)", MINTER_ROLE_HEX + abiAddressWord(from));
    const has = decodeUint(r.out) === 1n;
    ok = has;
    body.verification = { deployerHasMinterRole: has, source: r.source, ok };
  } else {
    if (!claim.to || !claim.units) throw new Fail(409, { error: "claim_unreadable" });
    const units = BigInt(claim.units);
    const bal = await solidRead(net, from, token.contractHex41, "balanceOf(address)", abiAddressWord(claim.to));
    const sup = await solidRead(net, from, token.contractHex41, "totalSupply()", "");
    const avail = await solidRead(net, from, token.contractHex41, "availableBalanceOf(address)", abiAddressWord(claim.to));
    const lots = await solidRead(net, from, token.contractHex41, "lotCount(address)", abiAddressWord(claim.to));
    const balance = decodeUint(bal.out);
    const supply = decodeUint(sup.out);
    const allSolid = [bal, sup, avail, lots].every((x) => x.source === "solidity");
    ok = balance === units && supply === units;
    body.verification = {
      ok,
      matchesExpected: ok,
      source: allSolid ? "solidity" : "fullnode_fallback",
      holder: hex41ToBase58(claim.to, sha256),
      balanceOfRaw: balance.toString(),
      availableBalanceOfRaw: decodeUint(avail.out).toString(),
      totalSupplyRaw: supply.toString(),
      lotCount: decodeUint(lots.out).toString(),
    };
    if (ok) {
      body.testBalance = {
        label: "TEST BALANCE",
        token: `${ONCHAIN.name} (${ONCHAIN.symbol})`,
        network: net,
        contract: token.contractBase58,
        holder: hex41ToBase58(claim.to, sha256),
        balance: formatUnits(balance, ONCHAIN.decimals),
        balanceRaw: balance.toString(),
        totalSupply: formatUnits(supply, ONCHAIN.decimals),
        note: "Solde de TEST sur reseau de test, sans valeur. Lu on-chain (balanceOf), pas declare. Ce n'est pas Tether USDT.",
      };
    }
  }
  if (ok && claim.status !== "confirmed") {
    await dbSwap(claimKey, rows[claimKey], JSON.stringify({ ...claim, status: "confirmed" }));
  }
  body.note = ok
    ? "Confirme : transaction solidifiee, receipt SUCCESS, et etat on-chain conforme a l'attendu."
    : "ANOMALIE : transaction SUCCESS mais l'etat lu on-chain ne correspond pas a l'attendu. Ne pas conclure.";
  return json(200, body);
}

// ---------------------------------------------------------------------------- point d'entree
Deno.serve(async (req: Request) => {
  try {
    const u = new URL(req.url);
    const action = u.searchParams.get("action") ?? "ping";
    const isGet = GET_ACTIONS.includes(action);
    const isPost = POST_ACTIONS.includes(action);
    if (!isGet && !isPost) return json(400, { error: "unknown_action", allowed: [...GET_ACTIONS, ...POST_ACTIONS] });
    if (isGet && req.method !== "GET") return json(405, { error: "method_not_allowed", expected: "GET" });
    if (isPost && req.method !== "POST") return json(405, { error: "method_not_allowed", expected: "POST" });

    let auth: Record<string, string>;
    try {
      auth = await dbGet(["token_admin_secret"]);
    } catch (_e) {
      return json(503, { error: "not_configured" });
    }
    const secret = auth["token_admin_secret"];
    if (!secret) return json(503, { error: "not_configured" });
    const given = req.headers.get("x-token-admin-secret") ?? "";
    if (!(await safeEqual(given, secret))) return json(401, { error: "unauthorized" });

    switch (action) {
      case "ping": return await handlePing();
      case "compile": return await handleCompile();
      case "cache": return await handleCache();
      case "selftest": return handleSelftest();
      case "address": return await handleAddress(u);
      case "plan": return await handlePlan(u);
      case "status": return await handleStatus(u);
      case "keygen": return await handleKeygen();
      case "deploy": return await handleDeploy(u);
      case "callplan": return await handleCallPlan(u);
      case "opstatus": return await handleOpStatus(u);
      case "grant_minter": return await handleGrantMinter(u);
      case "testmint": return await handleTestMint(u);
    }
    return json(400, { error: "unknown_action" });
  } catch (e) {
    if (e instanceof Fail) return json(e.status, e.body);
    if (e instanceof TronError) return json(502, { error: "tron_" + e.code, detail: e.detail });
    return json(500, { error: "internal", detail: String((e as Error)?.message ?? e).slice(0, 200) });
  }
});
