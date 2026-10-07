import type { BlurDetector } from './detector';
import { type PresetKey, patternsFor, sensitiveSpans, type TextSpan } from './patterns';
import { addRedactStyles, PICKED_CLASS, REDACT_CLASS, SHOWN_CLASS } from './styles';

export const REDACT_ATTR = 'data-mimik-redact';

const FIELD_FILTER = 'blur(10px)';
const RESCAN_AFTER_MS = 300;
const NON_TEXT_PARENTS = 'input, textarea, select, option, script, style, noscript, iframe';

function readableText(root: Node): Text[] {
  const found: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    const parent = text.parentElement;
    if (!parent || parent.matches(NON_TEXT_PARENTS) || parent.closest(`[${REDACT_ATTR}]`)) continue;
    if (text.data.trim()) found.push(text);
  }
  return found;
}

function toggleOnClick(target: HTMLElement, toggle: () => void) {
  target.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggle();
  });
}

export class PageRedactor implements BlurDetector {
  private kinds: PresetKey[] = [];
  private watcher: MutationObserver | null = null;
  private pending: ReturnType<typeof setTimeout> | undefined;
  private readonly rescanSoon = () => {
    clearTimeout(this.pending);
    this.pending = setTimeout(() => this.redact(), RESCAN_AFTER_MS);
  };

  start(kinds: PresetKey[]) {
    this.kinds = kinds;
    addRedactStyles();
    this.redact();
    this.watcher = new MutationObserver(this.rescanSoon);
    this.watcher.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    document.addEventListener('input', this.rescanSoon, true);
  }

  updatePresets(kinds: PresetKey[]) {
    this.unblurAll();
    this.kinds = kinds;
    this.redact();
  }

  stop() {
    this.detach();
    this.unblurAll();
  }

  detach() {
    this.watcher?.disconnect();
    this.watcher = null;
    document.removeEventListener('input', this.rescanSoon, true);
    clearTimeout(this.pending);
  }

  unblurAll() {
    for (const mark of Array.from(document.querySelectorAll(`span[${REDACT_ATTR}]`))) {
      const parent = mark.parentNode;
      mark.replaceWith(mark.textContent ?? '');
      parent?.normalize();
    }
    for (const field of Array.from(document.querySelectorAll<HTMLElement>(`[${REDACT_ATTR}="field"]`))) {
      field.style.removeProperty('filter');
      field.removeAttribute(REDACT_ATTR);
    }
    for (const picked of Array.from(document.getElementsByClassName(PICKED_CLASS)))
      picked.classList.remove(PICKED_CLASS);
  }

  private redact() {
    const patterns = patternsFor(this.kinds);
    if (patterns.length === 0) return;
    for (const text of readableText(document.body)) {
      const spans = sensitiveSpans(text.data, patterns);
      if (spans.length > 0) this.markSpans(text, spans);
    }
    for (const field of Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea'),
    )) {
      if (!field.hasAttribute(REDACT_ATTR) && field.value && sensitiveSpans(field.value, patterns).length > 0) {
        this.coverField(field);
      }
    }
  }

  private markSpans(text: Text, spans: TextSpan[]) {
    for (const { start, end } of [...spans].reverse()) {
      if (end < text.data.length) text.splitText(end);
      const piece = start > 0 ? text.splitText(start) : text;
      const mark = document.createElement('span');
      mark.className = REDACT_CLASS;
      mark.setAttribute(REDACT_ATTR, 'text');
      piece.replaceWith(mark);
      mark.append(piece);
      toggleOnClick(mark, () => mark.classList.toggle(SHOWN_CLASS));
    }
  }

  private coverField(field: HTMLInputElement | HTMLTextAreaElement) {
    field.style.setProperty('filter', FIELD_FILTER, 'important');
    field.setAttribute(REDACT_ATTR, 'field');
    toggleOnClick(field, () => {
      if (field.style.filter) field.style.removeProperty('filter');
      else field.style.setProperty('filter', FIELD_FILTER, 'important');
    });
  }
}
