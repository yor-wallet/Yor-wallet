/* Friendly Pay 13.0.0 sur la VRAIE application. Données de TEST injectées ; faux Supabase (aucune écriture réelle).
   Prouve : la page ne déborde plus à droite (cause du « décalage vers la gauche bloqué ») et revient à 0 si quelque chose la décale ;
   « Ce mois-ci » ne compte que les opérations CONFIRMÉES du mois ; bénéficiaires récents tirés de l'historique réel ; centre de
   notifications (texte construit depuis les données du serveur, toucher = reçu + lu). NE prouve PAS : le rendu sur un vrai iPhone. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { available, launch, openApp } from './ui-harness.mjs';

const skip = available() ? false : 'Chromium / Playwright / yor-wallet absents';
let browser;
test.before(async () => { if (!skip) browser = await launch(); });
test.after(async () => { if (browser) await browser.close(); });

async function boot(lang = 'en', viewport) {
  const s = await openApp(browser, { node: null, lang, role: 'user', ...(viewport ? { viewport } : {}) });
  await s.page.evaluate(() => {
    const now = Date.now();
    Runtime.profile = { firstName: 'Sajad', lastName: 'Ajmi', country: 'OM', phone: '+96890012345' };
    Runtime.accounts = [{ id: 'a1', type: 'MAIN', currency: 'OMR', balance: 500, availableBalance: 500, status: 'ACTIVE' }];
    Runtime.transactions = [
      { id: 't1', reference: 'YOR-TX-1', kind: 'FIAT_EXTERNAL', direction: 'OUT', status: 'SUCCESS', currency: 'OMR', amount: 20, createdAt: now - 60e3, beneficiary: { name: 'Aisha Said', phone: '+96891234567' } },
      { id: 't2', reference: 'YOR-TX-2', kind: 'ADMIN_DEPOSIT', direction: 'IN', status: 'SUCCESS', currency: 'OMR', amount: 45.25, createdAt: now - 120e3 },
      { id: 't3', reference: 'YOR-TX-3', kind: 'FIAT_EXTERNAL', direction: 'OUT', status: 'FAILED', currency: 'OMR', amount: 99, createdAt: now - 180e3, beneficiary: { name: '+96899887766', phone: '+96899887766' } },
      { id: 't4', reference: 'YOR-TX-4', kind: 'FIAT_EXTERNAL', direction: 'OUT', status: 'PENDING', currency: 'OMR', amount: 7, createdAt: now - 240e3, beneficiary: { name: 'Aisha Said', phone: '+96891234567' } },
      { id: 't5', reference: 'YOR-TX-5', kind: 'FIAT_EXTERNAL', direction: 'OUT', status: 'SUCCESS', currency: 'OMR', amount: 300, createdAt: now - 70 * 864e5, beneficiary: { name: 'Old', phone: '+96871112222' } }];
    Runtime.notifications = [{ id: 'n1', type: 'TRANSFER_SENT', title: 'Transfer sent', message: '20 OMR to Aisha Said', read: false, transactionId: 't1', data: { amount: 20, currency: 'OMR', to: 'Aisha Said', reference: 'YOR-TX-1' }, createdAt: now - 60e3 }];
    Runtime.receipts = [];
    window.__writes = [];
    UserDataEngine.writeSub = async (uid, sub, id, data) => { window.__writes.push({ sub, id, data }); if (sub === 'receipts') return; };
  });
  return s;
}

test('page : jamais plus large que l\'écran, et remise à 0 si quelque chose la décale (bug « bloquée à gauche »)', { skip }, async () => {
  const s = await boot('fr');
  for (const id of ['home', 'country-select', 'history', 'settings', 'profile', 'receive', 'notifications']) {
    await s.page.evaluate(i => R.go(i, { force: true }), id);
    const m = await s.page.evaluate(() => { const e = document.getElementById('screens'); return { sw: e.scrollWidth, cw: e.clientWidth }; });
    assert.ok(m.sw <= m.cw, `${id} : #screens ${m.sw} > ${m.cw}`);
  }
  await s.page.evaluate(() => { document.getElementById('screens').scrollLeft = 40; });
  await s.page.waitForTimeout(100);
  assert.equal(await s.page.evaluate(() => document.getElementById('screens').scrollLeft), 0);
  await s.ctx.close();
});

test('« Ce mois-ci » : seulement les opérations confirmées du mois (ni échec, ni en cours, ni mois passé) ; masqué = masqué', { skip }, async () => {
  const s = await boot('fr');
  assert.deepEqual(await s.page.evaluate(() => V13.monthStats()), { cur: 'OMR', sent: 20, recv: 45.25, n: 2 });
  await s.page.evaluate(() => R.go('home', { force: true }));
  const txt = await s.page.innerText('.v13-month');
  assert.match(txt, /Ce mois-ci/); assert.match(txt, /2 opérations/); assert.match(txt, /20,000/); assert.match(txt, /45,250/);
  assert.doesNotMatch(txt, /99|307|300/, 'aucun montant échoué / en cours / ancien');
  await s.page.evaluate(() => { Runtime.hideBalance = true; R.go('home', { force: true }); });
  assert.doesNotMatch(await s.page.innerText('.v13-month'), /\d,\d{3}/);
  await s.ctx.close();
});

test('bénéficiaires récents : numéros réellement utilisés, sans doublon ; un toucher remplit le numéro', { skip }, async () => {
  const s = await boot();
  await s.page.evaluate(() => { txReset(); R.go('country-select', { force: true }); });
  await s.page.waitForSelector('.v13-recent');
  assert.equal(await s.page.locator('.v13-rc').count(), 3, 'Aisha (une fois), le numéro de l\'échec, l\'ancien');
  await s.page.click('.v13-rc >> nth=0');
  assert.equal(await s.page.inputValue('#sp-num'), '9123 4567');
  await s.page.waitForFunction(() => !document.getElementById('sp-next').disabled);
  await s.ctx.close();
});

test('notifications : titre traduit depuis le type, montant et référence du serveur ; toucher = reçu + marquée lue', { skip }, async () => {
  const s = await boot('fr');
  await s.page.evaluate(() => R.go('notifications', { force: true }));
  const txt = await s.page.innerText('#notifications');
  assert.match(txt, /Transfert envoyé/); assert.match(txt, /À Aisha Said/); assert.match(txt, /20,000/); assert.match(txt, /FRD-TX-1/);
  assert.equal(await s.page.locator('.v13-n.unread').count(), 1);
  await s.page.click('[data-v13-n="n1"]');
  await s.page.waitForFunction(() => R.current() === 'receipt');
  assert.ok(await s.page.evaluate(() => window.__writes.some(w => w.sub === 'notifications' && w.id === 'n1' && w.data.read === true)));
  assert.match(await s.page.innerText('#receipt-ref'), /FRD-TX-1/);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('tirer pour actualiser : recharge depuis le serveur (hydrateRuntime) ; hors ligne, rien n\'est inventé', { skip }, async () => {
  const s = await boot('fr');
  await s.page.evaluate(() => { window.__hyd = 0; AuthEngine.hydrateRuntime = async () => { window.__hyd++; }; R.go('home', { force: true }); });
  await s.page.evaluate(() => V13.refresh(null, 'home'));
  assert.equal(await s.page.evaluate(() => window.__hyd), 1);
  await s.page.waitForSelector('.toast');
  assert.match(await s.page.innerText('#toasts'), /Mis à jour/);
  await s.ctx.setOffline(true);
  await s.page.evaluate(() => V13.refresh(null, 'home'));
  assert.equal(await s.page.evaluate(() => window.__hyd), 1, 'pas d\'appel hors ligne');
  assert.match(await s.page.innerText('#toasts'), /Pas de connexion/);
  await s.ctx.setOffline(false);
  await s.ctx.close();
});
