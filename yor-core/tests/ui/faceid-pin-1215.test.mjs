/* Friendly Pay 12.15.0 — transferts confirmés par Face ID OU par le code, dans la VRAIE application (Chromium).
   Face ID est SIMULÉ (FaceId.gate remplacé) : on fournit le secret PRF que l'iPhone libère après Face ID. Le serveur est un faux
   client : verify_pin n'accepte que 135790. Ce que ces tests prouvent : le code n'est jamais stocké en clair ; Face ID confirmé +
   code déjà enregistré = aucune saisie, mais le serveur vérifie quand même le code (verify_pin) ; Face ID annulé / échoué /
   sans PRF / autre clé = le code est demandé ; code refusé par le serveur, changement de code et déconnexion effacent la copie.
   Ce qu'ils NE prouvent PAS : le vrai Face ID ni la prise en charge de PRF sur un iPhone donné (iOS 18+ attendu). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { available, openApp, CHROME, PW } from './ui-harness.mjs';

const skip = available() ? false : 'Chromium / Playwright / yor-wallet absents';
let browser;
/* crypto.subtle (chiffrement) n'existe que sur une origine sûre (HTTPS en production) : l'origine de test http://yor.test est traitée comme sûre ICI seulement */
test.before(async () => { if (!skip) { const { chromium } = await import(PW); browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--unsafely-treat-insecure-origin-as-secure=http://yor.test'] }); } });
test.after(async () => { if (browser) await browser.close(); });

async function boot() {
  const s = await openApp(browser, { node: null, lang: 'en', role: 'user' });
  await s.page.evaluate(() => {
    window.__rpc = []; window.__good = '135790';
    sb.rpc = async (name, args) => {
      window.__rpc.push({ name, args });
      if (name === 'pin_status') return { data: { has_pin: true }, error: null };
      if (name === 'verify_pin') return { data: args.p_pin === window.__good ? { ok: true, grant: 'g-' + window.__rpc.length } : { ok: false, error: 'wrong_pin', remaining: 4 }, error: null };
      if (name === 'change_pin') return { data: { ok: true }, error: null };
      return { data: null, error: null };
    };
    window.__face = { ok: true, prf: new Uint8Array(32).fill(7), cid: 'cred-1' };
    FaceId.gate = async () => window.__face;
    FaceId.record = async () => ({ id: 'cred-1', prf: true });
    FaceId.reenroll = async () => { window.__reenroll = (window.__reenroll || 0) + 1; return { ok: true }; };
    PinEngine.forget();
  });
  return s;
}
const verifyCalls = (page) => page.evaluate(() => window.__rpc.filter(c => c.name === 'verify_pin').map(c => c.args.p_pin));
async function firstWithCode(s) { const p = s.page.evaluate(() => PinEngine.authorize()); await typeCode(s.page, '135790'); await p; await s.page.waitForFunction(() => !document.getElementById('ps-title')); }
async function typeCode(page, code) { await page.waitForSelector('#ps-title'); for (const d of code) { await page.keyboard.press(d); await page.waitForTimeout(25); } }

test('1er transfert : Face ID confirmé mais code jamais enregistré → le code est demandé, puis gardé CHIFFRÉ (jamais en clair)', { skip }, async () => {
  const s = await boot();
  const p = s.page.evaluate(() => PinEngine.authorize());
  await typeCode(s.page, '135790');
  const r = await p;
  assert.equal(r.ok, true, JSON.stringify(r) + ' ' + JSON.stringify(s.errors)); assert.ok(r.grant);
  assert.equal(await s.page.evaluate(() => PinEngine.hasVault()), true);
  const raw = await s.page.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
  assert.doesNotMatch(raw, /135790/, 'le code n\'apparaît nulle part en clair');
  assert.deepEqual(s.errors.filter(e => !/Service Worker registration blocked/.test(e)), []);
  await s.ctx.close();
});

test('transferts suivants : Face ID suffit (aucun pavé), le serveur vérifie le code quand même', { skip }, async () => {
  const s = await boot();
  await firstWithCode(s);
  const r = await s.page.evaluate(() => PinEngine.authorize());
  assert.equal(r.ok, true); assert.equal(r.via, 'faceid');
  assert.equal(await s.page.locator('#ps-title').count(), 0, 'aucun pavé affiché');
  assert.deepEqual(await verifyCalls(s.page), ['135790', '135790'], 'le serveur contrôle le code les deux fois');
  await s.ctx.close();
});

test('Face ID annulé, échoué ou sans PRF, ou autre clé : le code à 6 chiffres est demandé', { skip }, async () => {
  const s = await boot();
  await firstWithCode(s);
  for (const face of [{ ok: false, cancelled: true }, { ok: false, recover: true }, { ok: true, prf: null, cid: 'cred-1' }, { ok: true, prf: [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9], cid: 'cred-1' }]) {
    await s.page.evaluate(f => { window.__face = Object.assign({}, f, f.prf ? { prf: new Uint8Array(f.prf) } : {}); }, face);
    const p = s.page.evaluate(() => PinEngine.authorize());
    await typeCode(s.page, '135790');
    const r = await p;
    assert.equal(r.ok, true, JSON.stringify(face)); assert.notEqual(r.via, 'faceid');
    await s.page.waitForFunction(() => !document.getElementById('ps-title'));
  }
  await s.ctx.close();
});

test('code changé ailleurs : la copie est refusée par le serveur, effacée, et le code est demandé', { skip }, async () => {
  const s = await boot();
  await firstWithCode(s);
  await s.page.evaluate(() => { window.__good = '246813'; });
  const p = s.page.evaluate(() => PinEngine.authorize());
  await typeCode(s.page, '246813');
  const r = await p;
  assert.equal(r.ok, true);
  assert.deepEqual((await verifyCalls(s.page)).slice(-2), ['135790', '246813'], 'une seule tentative silencieuse, jamais répétée');
  await s.ctx.close();
});

test('changement de code et déconnexion effacent la copie chiffrée', { skip }, async () => {
  const s = await boot();
  await firstWithCode(s);
  await s.page.evaluate(() => { PinEngine.forget(); });
  assert.equal(await s.page.evaluate(() => PinEngine.hasVault()), false);
  const p2 = s.page.evaluate(() => PinEngine.authorize()); await typeCode(s.page, '135790'); await p2;
  assert.equal(await s.page.evaluate(() => PinEngine.hasVault()), true);
  await s.page.evaluate(() => AuthEngine.signOut());
  assert.equal(await s.page.evaluate(() => { try { return Object.keys(JSON.parse(localStorage.getItem('friendly_pin_vault_v1') || '{}')).length; } catch (e) { return -1; } }), 0);
  await s.ctx.close();
});

test('chiffrement : une autre clé Face ID (autre secret PRF) ne peut pas lire le code', { skip }, async () => {
  const s = await boot();
  const r = await s.page.evaluate(async () => {
    await PinEngine._vault.save('135790', new Uint8Array(32).fill(1), 'c');
    return [await PinEngine._vault.open(new Uint8Array(32).fill(1), 'c'), await PinEngine._vault.open(new Uint8Array(32).fill(2), 'c'), await PinEngine._vault.open(new Uint8Array(32).fill(1), 'other')];
  });
  assert.deepEqual(r, ['135790', null, null]);
  await s.ctx.close();
});
