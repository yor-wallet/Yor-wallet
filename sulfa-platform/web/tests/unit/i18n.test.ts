import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DICTS, LANGS, translate } from '@/lib/i18n/dict';

const SRC = join(__dirname, '../../src');
const files = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : []; });
const code = files(SRC).filter(f => !f.includes('/i18n/')).map(f => readFileSync(f, 'utf8')).join('\n');

describe('dictionaries', () => {
  it('ar, fr and en have exactly the same keys', () => {
    const fr = Object.keys(DICTS.fr).sort();
    for (const l of LANGS) expect(Object.keys(DICTS[l]).sort()).toEqual(fr);
  });
  it('no empty translation, and the same {placeholders} in every language', () => {
    for (const k of Object.keys(DICTS.fr) as (keyof typeof DICTS.fr)[]) {
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
      for (const l of LANGS) {
        expect(DICTS[l][k].trim(), `${l}:${k}`).not.toBe('');
        if (k !== 'an_n.vars') expect(ph(DICTS[l][k]), `${l}:${k}`).toBe(ph(DICTS.fr[k]));
      }
    }
  });
  it('every literal key used in the code exists', () => {
    const used = new Set([...code.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)].map(m => m[1]));
    const missing = [...used].filter(k => !(k in DICTS.fr) && !/[._]$/.test(k));
    expect(missing).toEqual([]);
  });
  it('Arabic is really Arabic (no French left behind) and is the default', () => {
    const latinOnly = Object.entries(DICTS.ar).filter(([k, v]) => !/[؀-ۿ]/.test(v) && !['cur'].includes(k) && !/^(SULFA|OMR|IBAN|PDF|JPG)/.test(v));
    expect(latinOnly.map(([k]) => k)).toEqual([]);
    expect(translate('ar', 'nav.login')).toBe('تسجيل الدخول');
  });
  it('interpolates variables', () => {
    expect(translate('fr', 'sim.months', { n: 6 })).toBe('6 mois');
    expect(translate('en', 'nav.hello', { name: 'Aisha' })).toBe('Hello Aisha');
  });
});
