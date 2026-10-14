import { reactive } from 'vue';
import { EN, TL } from '../i18n/dictionaries.js?v=168';

// The interface language. English is the source text; Tagalog (shown as "PH") overrides it key by
// key, and anything not yet translated falls back to English rather than showing a bare key. The
// choice is remembered in this browser only — it is a display preference, not part of an account.

export const LANGUAGES = [
  { code: 'en', short: 'EN', label: 'English' },
  { code: 'tl', short: 'PH', label: 'Tagalog' },
];

const STORAGE_KEY = 'pt-lang';

function stored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return LANGUAGES.some((l) => l.code === v) ? v : 'en';
  } catch (e) {
    return 'en';
  }
}

export const i18n = reactive({ lang: stored() });

document.documentElement.lang = i18n.lang === 'tl' ? 'fil' : 'en';

export function setLang(code) {
  if (!LANGUAGES.some((l) => l.code === code)) return;
  i18n.lang = code;
  document.documentElement.lang = code === 'tl' ? 'fil' : 'en';
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch (e) { /* private window: the choice lasts until the page closes */ }
}

/** The text for a key in the current language; {name}-style placeholders are filled from params. */
export function t(key, params) {
  const text = (i18n.lang === 'tl' ? TL[key] : undefined) ?? EN[key] ?? key;
  return params ? text.replace(/\{(\w+)\}/g, (m, name) => (params[name] !== undefined ? params[name] : m)) : text;
}

/**
 * Like t(), for text that already sits in the template or in data in English: the English is passed
 * as the fallback, so only Tagalog needs an entry in the dictionary and English can never go missing.
 * $tx('lp.hero.title', 'Track your permit') — Tagalog if there is one for the key, else that text.
 */
export function tx(key, fallback, params) {
  const text = (i18n.lang === 'tl' ? TL[key] : undefined) ?? fallback;
  return params ? text.replace(/\{(\w+)\}/g, (m, name) => (params[name] !== undefined ? params[name] : m)) : text;
}
