/**
 * Idioma atual (sem React, para os jogos também usarem). Por enquanto: pt-BR e en-US (decisão do Leon, 01/11).
 * O espanhol tem dicionário do portal pronto, mas fica fora do seletor até os jogos serem traduzidos.
 */
export type Lang = 'pt-BR' | 'en-US' | 'es-ES';
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'pt-BR', label: 'Português (Brasil)' },
  { id: 'en-US', label: 'English' },
];
const KEY = 'jogaco.lang';
export const LANG_EVENT = 'clashcade:lang';

/** pt* → português; qualquer outro idioma do navegador → inglês. */
export function detectLang(nav: readonly string[] = typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : []): Lang {
  for (const l of nav) if (l.toLowerCase().startsWith('pt')) return 'pt-BR';
  return nav.length ? 'en-US' : 'pt-BR';
}

export function getLang(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v && LANGS.some((l) => l.id === v)) return v as Lang;
  } catch {
    /* sem armazenamento */
  }
  return detectLang();
}

export function setLang(l: Lang) {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* ignora */
  }
  document.documentElement.lang = l;
  window.dispatchEvent(new CustomEvent(LANG_EVENT));
}

export const isEn = () => getLang() === 'en-US';
/** Texto curto dentro dos jogos: T('Vez de', 'Turn of'). */
export const T = (pt: string, en: string) => (isEn() ? en : pt);
