/**
 * Tradução por DOM para os jogos com interface própria (Sinuca e Minigolfe), que têm centenas de textos fixos no HTML.
 * Em inglês, troca textos e atributos (title, aria-label, placeholder) que batem EXATAMENTE com o dicionário, ou com
 * um padrão (frases com nome/número). Observa mudanças (avisos, cartões, placar), então textos novos também mudam.
 * Em português não faz nada. Texto sem tradução continua em português (lista do que falta: qa/i18n-faltando.cjs).
 */
import { isEn } from './lang';

export type Patterns = [RegExp, string][];
const ATTRS = ['title', 'aria-label', 'placeholder'] as const;

function tr(text: string, dict: Record<string, string>, pats: Patterns): string | null {
  const t = text.trim();
  if (!t) return null;
  const hit = dict[t];
  if (hit !== undefined) return text.replace(t, hit);
  for (const [re, to] of pats) {
    if (re.test(t)) return text.replace(t, t.replace(re, to));
  }
  return null;
}

function walk(node: Node, dict: Record<string, string>, pats: Patterns) {
  if (node.nodeType === Node.TEXT_NODE) {
    const v = tr(node.nodeValue ?? '', dict, pats);
    if (v !== null && v !== node.nodeValue) node.nodeValue = v;
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
  for (const a of ATTRS) {
    const cur = el.getAttribute(a);
    if (cur) {
      const v = tr(cur, dict, pats);
      if (v !== null && v !== cur) el.setAttribute(a, v);
    }
  }
  for (const c of Array.from(el.childNodes)) walk(c, dict, pats);
}

/** Liga a tradução no contêiner; devolve a função que desliga (chamar no destroy). */
export function translateDom(root: HTMLElement, dict: Record<string, string>, pats: Patterns = []): () => void {
  if (!isEn()) return () => undefined;
  walk(root, dict, pats);
  const mo = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') walk(m.target, dict, pats);
      else if (m.type === 'attributes') walk(m.target, dict, pats);
      else m.addedNodes.forEach((n) => walk(n, dict, pats));
    }
  });
  mo.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
  return () => mo.disconnect();
}
