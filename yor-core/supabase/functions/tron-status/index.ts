// tron-status — lecture seule. Vérifie que Supabase atteint un nœud TRON TESTNET (Shasta ou Nile).
// - GET uniquement, JWT Supabase requis, URLs fixes en dur (aucune URL fournie par l'appelant : pas de SSRF).
// - mainnet explicitement refusé.
// - aucun secret n'est renvoyé : seulement des booléens « configuré / non configuré ».
// - cache mémoire de 10 s par réseau pour ne pas marteler TronGrid.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const NETS: Record<string, string> = {
  shasta: "https://api.shasta.trongrid.io",
  nile: "https://nile.trongrid.io",
};
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "GET, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json", "cache-control": "no-store" } });

const cache = new Map<string, { at: number; body: Record<string, unknown> }>();

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "GET") return json(405, { error: "method_not_allowed" });

  const network = (new URL(req.url).searchParams.get("network") ?? "shasta").toLowerCase();
  if (network === "mainnet") return json(400, { error: "mainnet_refused", detail: "this function only talks to testnets" });
  const base = NETS[network];
  if (!base) return json(400, { error: "unknown_network", allowed: Object.keys(NETS) });

  const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json" };
  const key = Deno.env.get("TRONGRID_API_KEY");
  if (key) headers["TRON-PRO-API-KEY"] = key;

  // ?probe=1 : trois requêtes FIXES (aucune entrée de l'appelant) qui vérifient la forme des réponses réelles du nœud
  // utilisée par la couche blockchain : transaction introuvable (nœud complet + solidity) et appel de contrat invalide.
  if (new URL(req.url).searchParams.get("probe") === "1") {
    const pk = "probe:" + network;
    const ph = cache.get(pk);
    if (ph && Date.now() - ph.at < 10_000) return json(200, { ...ph.body, cached: true });
    const ZERO_TX = "0".repeat(64);
    const ZERO_ADDR = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";
    const calls: Array<[string, string, unknown]> = [
      ["fullnode_tx_info", "/wallet/gettransactioninfobyid", { value: ZERO_TX }],
      ["solidity_tx_info", "/walletsolidity/gettransactioninfobyid", { value: ZERO_TX }],
      ["constant_call_invalid_contract", "/wallet/triggerconstantcontract",
        { owner_address: ZERO_ADDR, contract_address: ZERO_ADDR, function_selector: "totalSupply()", parameter: "", visible: true }],
    ];
    const out: Record<string, unknown> = {};
    for (const [name, path, payload] of calls) {
      try {
        const r = await fetch(base + path, { method: "POST", headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(8000) });
        const text = await r.text();
        out[name] = { status: r.status, body: text.slice(0, 400) };
      } catch (_e) {
        out[name] = { error: "unreachable" };
      }
    }
    const pbody = { ok: true, network, probe: out, checkedAt: new Date().toISOString() };
    cache.set(pk, { at: Date.now(), body: pbody });
    return json(200, pbody);
  }

  const hit = cache.get(network);
  if (hit && Date.now() - hit.at < 10_000) return json(200, { ...hit.body, cached: true });

  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  let body: Record<string, unknown>;
  try {
    const res = await fetch(`${base}/wallet/getnowblock`, { method: "POST", headers, body: "{}", signal: ctrl.signal });
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      return json(502, { ok: false, network, reachable: true, error: `http_${res.status}`, latencyMs });
    }
    const j = await res.json();
    const raw = j?.block_header?.raw_data;
    if (!raw || !Number.isInteger(raw.number)) return json(502, { ok: false, network, reachable: true, error: "bad_response", latencyMs });
    body = {
      ok: true,
      network,
      reachable: true,
      latestBlock: raw.number,
      blockTimestamp: raw.timestamp ?? null,
      latencyMs,
      checkedAt: new Date().toISOString(),
      apiKey: key ? "configured" : "absent",
      tokenContractDeployed: !!Deno.env.get("YOR_TOKEN_CONTRACT_ADDRESS"),
      signing: Deno.env.get("YOR_SIGNING_PROVIDER") ? "configured" : "Wallet signing provider not configured",
    };
  } catch (e) {
    return json(502, { ok: false, network, reachable: false, error: ctrl.signal.aborted ? "timeout" : "unreachable", latencyMs: Date.now() - started });
  } finally {
    clearTimeout(timer);
  }
  cache.set(network, { at: Date.now(), body });
  return json(200, body);
});
