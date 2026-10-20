import { fr } from './fr';
import { ar } from './ar';
import { en } from './en';

export type Lang = 'ar' | 'fr' | 'en';
export const LANGS: Lang[] = ['ar', 'fr', 'en'];
export const LANG_NAMES: Record<Lang, string> = { ar: 'العربية', fr: 'Français', en: 'English' };
export type Key = keyof typeof fr;
/** every language must define exactly the French keys (checked by TypeScript and by tests/unit/i18n.test.ts) */
export const DICTS: Record<Lang, Record<Key, string>> = { fr, ar, en };

export function translate(lang: Lang, key: string, vars?: Record<string, string | number | null | undefined>): string {
  const d = DICTS[lang] as Record<string, string>;
  const s = d[key] ?? (DICTS.fr as Record<string, string>)[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : String(vars[k]))) : s;
}
