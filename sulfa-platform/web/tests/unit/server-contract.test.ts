/* Ties the web app to the SQL migration: every error the server can raise and every notification it can create has a text,
   and every RPC the web app calls exists in the migration with the same parameter names. */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DICTS, LANGS } from '@/lib/i18n/dict';
import { TEMPLATE_KEYS, renderNotification } from '@/lib/notif';
import { describeError } from '@/lib/errors';

const sql = readdirSync(join(__dirname, '../../../supabase/migrations')).map(f => readFileSync(join(__dirname, '../../../supabase/migrations', f), 'utf8')).join('\n');
const SRC = join(__dirname, '../../src');
const files = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : []; });
const code = files(SRC).map(f => readFileSync(f, 'utf8')).join('\n');

describe('server contract', () => {
  it('every sulfa_* exception raised by the SQL has a message in ar / fr / en', () => {
    const codes = [...new Set([...sql.matchAll(/raise exception '(sulfa_[a-z_]+)/g)].map(m => m[1]))];
    expect(codes.length).toBeGreaterThan(25);
    for (const c of codes) for (const l of LANGS) expect(DICTS[l], `${l}: err.${c}`).toHaveProperty('err.' + c);
  });
  it('every notification template the SQL can create is known and rendered without leftover {placeholders}', () => {
    const literal = [...sql.matchAll(/sulfa__notify\([^,]+, '([A-Z_]+)',/g)].map(m => m[1]);
    const dynamic = [...sql.matchAll(/sulfa__notify\([^,]+, '([A-Z_]+_)' \|\| /g)].map(m => m[1]);
    for (const k of literal) expect(TEMPLATE_KEYS).toContain(k);
    for (const p of dynamic) expect(TEMPLATE_KEYS.some(k => k.startsWith(p))).toBe(true);
    const params = { reference: 'SLF-1', amount: 100, term: 6, currency: 'OMR', reason: 'x', document_type: 'id_front', monthly: 10, tx_reference: 'SLFTX-1', first_due: '2026-11-20', outstanding: 5, seq: 1, date: '2026-11-20', first_name: 'A', identity_status: 'VERIFIED', application: 'SLF-1' };
    for (const k of TEMPLATE_KEYS) for (const l of LANGS) {
      const r = renderNotification({ template_key: k, params }, l);
      expect(r.title + r.body, `${l}:${k}`).not.toMatch(/\{\w+\}|n\.[A-Z]/);
    }
  });
  it('every RPC called by the web app exists in the migration with the same parameter names', () => {
    const calls = [...code.matchAll(/rpc(?:<[^>]*>)?\(\s*'(sulfa_[a-z_]+)'\s*(?:,\s*\{([^}]*)\})?/g)];
    expect(calls.length).toBeGreaterThan(20);
    for (const [, fn, args] of calls) {
      const def = new RegExp(`function public\\.${fn}\\(([^)]*)\\)`).exec(sql);
      expect(def, fn).not.toBeNull();
      const params = (def![1].match(/\bp_?[a-z_]*\b(?= )/g) ?? []).filter(x => x.startsWith('p'));
      for (const a of (args ?? '').matchAll(/\b(p_[a-z_]+|p)\s*:/g)) expect(params, `${fn}(${a[1]})`).toContain(a[1]);
    }
  });
  it('errors: a SQLSTATE answer is certain, no answer is uncertain', () => {
    expect(describeError({ message: 'sulfa_insufficient_funds', code: '22023' })).toMatchObject({ key: 'err.sulfa_insufficient_funds', certain: true });
    expect(describeError({ message: 'sulfa_direct_write_forbidden: UPDATE on x', code: '42501' }).key).toBe('err.sulfa_direct_write_forbidden');
    expect(describeError({ message: 'TypeError: Failed to fetch' })).toMatchObject({ key: 'err.uncertain', certain: false });
    expect(describeError({ message: 'something', code: 'XX000' })).toMatchObject({ key: 'err.unknown', certain: true });
    expect(describeError({ message: 'Invalid login credentials', code: 'invalid_credentials', status: 400 }).key).toBe('err.invalid_login');
  });
});
