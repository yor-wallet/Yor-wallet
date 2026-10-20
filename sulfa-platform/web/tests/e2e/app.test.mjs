/* The installed-app experience on a phone (390 × 844). Proves: launch screen then a 3-screen onboarding for visitors;
   a signed-in user goes straight to their space; bottom tab bar with short labels; "More" sheet with the other sections. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { available, launch, open, serve, PROFILE } from './harness.mjs';

const skip = available() ? false : 'out/ not built (npm run build:e2e) or Playwright missing';
let browser, srv;
test.before(async () => { if (skip) return; srv = await serve(); open.server = srv; browser = await launch(); });
test.after(async () => { await browser?.close(); await srv?.close(); });
const V = { width: 390, height: 844 };
const user = { id: 'c1000000-0000-0000-0000-0000000000c1', email: 'aisha@example.test' };
const client = { 'rpc:sulfa_ensure_profile': () => PROFILE(), 'GET:sulfa_admins': () => [], 'rpc:sulfa_my_summary': () => ({ balance: 0, reserved: 0, available: 0, open_applications: 0, approved_total: 0, outstanding: 0, repaid_total: 0, next_due: null, unread: 0 }),
  'GET:sulfa_applications': () => [], 'GET:sulfa_notifications': () => [], 'GET:sulfa_installments': () => [] };

test('manifest: the installed app starts on /app/ in portrait, standalone', { skip }, () => {
  const m = JSON.parse(readFileSync(new URL('../../out/manifest.webmanifest', import.meta.url)));
  assert.equal(m.start_url, '/app/'); assert.equal(m.display, 'standalone'); assert.equal(m.orientation, 'portrait');
});

test('visitor: launch screen, then three onboarding screens with portraits, then sign-up', { skip }, async () => {
  const s = await open(browser, { path: '/app/', lang: 'en', viewport: V });
  await s.page.waitForSelector('.launch .launch-icon img');
  await s.page.waitForSelector('text=Your application, tracked live');
  assert.ok(await s.page.locator('.onboard img[aria-label="Aisha, client"]').count() === 1);
  await s.page.click('button:has-text("Continue")'); await s.page.waitForTimeout(700);
  await s.page.click('button:has-text("Continue")'); await s.page.waitForTimeout(700);
  await s.page.click('a:has-text("Create my account")');
  await s.page.waitForURL(/\/signup\/$/);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('sign-out plays the goodbye screen, then returns to the app without replaying the launch', { skip }, async () => {
  const s = await open(browser, { path: '/client/', lang: 'en', user, viewport: V, handlers: client });
  await s.page.locator('nav.tabbar button:has-text("More")').click();
  await s.page.locator('[role="dialog"][aria-label="More"] button:has-text("Sign out")').click();
  await s.page.waitForSelector('.launch-closing:has-text("See you soon")');
  await s.page.waitForURL(/\/app\/$/, { timeout: 8000 });
  await s.page.waitForSelector('text=Your application, tracked live', { timeout: 1500 });
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});

test('iOS: home-screen icon and launch screens are declared and served', { skip }, async () => {
  const s = await open(browser, { path: '/app/', lang: 'en', viewport: V });
  const links = await s.page.evaluate(() => [...document.querySelectorAll('link')].map(l => [l.rel, l.getAttribute('href'), l.media || '']));
  const apple = links.find(l => l[0] === 'apple-touch-icon');
  assert.ok(apple && apple[1].endsWith('/apple-touch-icon.png'));
  const starts = links.filter(l => l[0] === 'apple-touch-startup-image');
  assert.equal(starts.length, 10);
  for (const [, href] of [apple, ...starts]) assert.equal((await s.page.request.get(new URL(href, s.page.url()).href)).status(), 200, href);
  assert.ok(starts.some(l => l[1].includes('1179x2556') && l[2].includes('393px')));
  await s.ctx.close();
});

test('signed-in client opening the app goes straight to their space', { skip }, async () => {
  const s = await open(browser, { path: '/app/', lang: 'en', user, viewport: V, handlers: client });
  await s.page.waitForURL(/\/client\/$/);
  await s.ctx.close();
});

test('phone: bottom tab bar with short labels; "More" opens a sheet with the other sections and sign-out', { skip }, async () => {
  const s = await open(browser, { path: '/client/', lang: 'en', user, viewport: V, handlers: client });
  const bar = s.page.locator('nav.tabbar');
  await bar.waitFor();
  assert.deepEqual((await bar.locator('a, button').allInnerTexts()).map(x => x.trim()), ['Home', 'Requests', 'Schedule', 'Alerts', 'More']);
  const box = await bar.boundingBox();
  assert.ok(Math.abs(box.y + box.height - V.height) < 2, 'stuck to the bottom of the screen');
  await bar.locator('a:has-text("Schedule")').click();
  await s.page.waitForURL(/\/client\/installments\/$/);
  await bar.locator('button:has-text("More")').click();
  const sheet = s.page.locator('[role="dialog"][aria-label="More"]');
  await sheet.waitFor();
  for (const x of ['My documents', 'Withdrawal', 'History', 'Settings', 'Sign out']) assert.match(await sheet.innerText(), new RegExp(x));
  await sheet.locator('a:has-text("Withdrawal")').click();
  await s.page.waitForURL(/\/client\/withdraw\/$/);
  assert.deepEqual(s.errors, []);
  await s.ctx.close();
});
