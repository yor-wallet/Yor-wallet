'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { translate, type Lang, LANGS } from './dict';
import { money, date } from '../format';

export type { Lang } from './dict';
type Vars = Record<string, string | number | null | undefined>;
type Ctx = { lang: Lang; dir: 'rtl' | 'ltr'; setLang: (l: Lang) => void; t: (k: string, v?: Vars) => string;
  money: (v: number | string | null | undefined, withCurrency?: boolean) => string; date: (v: string | null | undefined, withTime?: boolean) => string };

const I18n = createContext<Ctx | null>(null);
const STORE = 'sulfa_lang';

export function readStoredLang(): Lang {
  try { const l = localStorage.getItem(STORE) as Lang; if (LANGS.includes(l)) return l; } catch {}
  return 'ar';                                                        // Arabic is the default language
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ar');
  useEffect(() => { setLangState(readStoredLang()); }, []);
  useEffect(() => {
    const el = document.documentElement;
    el.lang = lang; el.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);
  const setLang = useCallback((l: Lang) => { setLangState(l); try { localStorage.setItem(STORE, l); } catch {} }, []);
  const value = useMemo<Ctx>(() => ({
    lang, dir: lang === 'ar' ? 'rtl' : 'ltr', setLang,
    t: (k, v) => translate(lang, k, v),
    money: (v, wc = true) => money(v, lang, wc),
    date: (v, wt = false) => date(v, lang, wt),
  }), [lang, setLang]);
  return <I18n.Provider value={value}>{children}</I18n.Provider>;
}

export function useI18n(): Ctx {
  const c = useContext(I18n);
  if (!c) throw new Error('useI18n outside I18nProvider');
  return c;
}
