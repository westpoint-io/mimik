import { getCssSelector } from 'css-selector-generator';
import type { ElementMeta } from '@/core/guides/types';
import { getFieldLabel, isRedactedField, isSensitiveField } from './element-utils';

const SKIP_TEXT = 'script, style, [hidden], [aria-hidden="true"]';

const LINE_SELECTOR =
  'address, article, aside, blockquote, dd, div, dl, dt, fieldset, figcaption, figure, footer, form, h1, h2, h3, h4, h5, h6, header, legend, li, main, nav, ol, option, p, pre, section, table, td, th, tr, ul';

function getCleanText(el: HTMLElement): string | null {
  if (el instanceof HTMLInputElement) return null;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node instanceof Element && node.matches(SKIP_TEXT) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const lines: string[] = [];
  let line = '';
  let owner: Element | null = null;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node instanceof Element) {
      if (node.tagName === 'BR') {
        lines.push(line);
        line = '';
        owner = null;
      }
      continue;
    }
    const block = node.parentElement?.closest(LINE_SELECTOR);
    const next = block && el.contains(block) ? block : el;
    if (next !== owner) {
      lines.push(line);
      line = '';
      owner = next;
    }
    line += node.textContent ?? '';
  }
  lines.push(line);
  const firstLine = lines.map((text) => text.replace(/\s+/g, ' ').trim()).find((text) => text.length > 2);
  return firstLine?.slice(0, 80) || null;
}

export interface FrozenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function freezeRect(el: Element): FrozenRect {
  const { x, y, width, height } = el.getBoundingClientRect();
  return { x, y, width, height };
}

export function extractElementMeta(el: HTMLElement, atEvent?: FrozenRect): ElementMeta {
  const live = freezeRect(el);
  const rect = live.width > 0 || live.height > 0 ? live : (atEvent ?? live);
  let cssSelector: string;
  try {
    cssSelector = getCssSelector(el);
  } catch {
    cssSelector = el.tagName?.toLowerCase() ?? 'unknown';
  }
  const isField =
    el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
  const fixedValue =
    el instanceof HTMLInputElement && (el.readOnly || el.disabled) && !isSensitiveField(el) && !isRedactedField(el)
      ? el.value
      : '';
  return {
    source: 'dom',
    tag: el.tagName?.toLowerCase() ?? 'unknown',
    cssSelector,
    textContent: getCleanText(el),
    ariaLabel: el.getAttribute('aria-label'),
    label: isField ? getFieldLabel(el) || fixedValue || null : null,
    placeholder: el.getAttribute('placeholder'),
    altText: el instanceof HTMLImageElement ? el.alt : el.getAttribute('title'),
    name: el.getAttribute('name'),
    role: el.getAttribute('role') || (el.tagName?.toLowerCase() ?? null),
    href: el instanceof HTMLAnchorElement ? el.href : null,
    inputType: el instanceof HTMLInputElement ? el.type : null,
    dataTestId: el.getAttribute('data-testid') || el.getAttribute('data-test-id') || el.getAttribute('data-qa') || null,
    rect,
    devicePixelRatio: window.devicePixelRatio,
  };
}
