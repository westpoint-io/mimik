import { findMatches, type MatchRange, PRESET_REGEXES, type PresetKey } from './regexes';
import { injectBlurStyles } from './styles';

const BLUR_CLASS = 'mimik-blur';
const BLUR_ATTR = 'data-mimik-blur';
const PEEK_CLASS = 'mimik-blur-peek';
const EXCLUDED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION']);

export class BlurScanner {
  private observer: MutationObserver | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private activePresets: PresetKey[] = [];

  start(presets: PresetKey[]) {
    this.activePresets = presets;
    injectBlurStyles();
    this.scan();
    this.observe();
  }

  updatePresets(presets: PresetKey[]) {
    this.unblurAll();
    this.activePresets = presets;
    this.scan();
  }

  stop() {
    this.detach();
    this.unblurAll();
  }

  detach() {
    this.observer?.disconnect();
    this.observer = null;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  private getActivePatterns(): RegExp[] {
    const patterns: RegExp[] = [];
    for (const key of this.activePresets) {
      const regex = PRESET_REGEXES[key];
      if (regex) patterns.push(new RegExp(regex.source, regex.flags));
    }
    return patterns;
  }

  private scan() {
    const patterns = this.getActivePatterns();
    if (patterns.length === 0) return;
    this.blurTextNodes(document.body, patterns);
    this.blurInputFields(patterns);
  }

  private blurTextNodes(root: Node, patterns: RegExp[]) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (!node.parentElement) return NodeFilter.FILTER_REJECT;
        if (EXCLUDED_TAGS.has(node.parentElement.tagName)) return NodeFilter.FILTER_REJECT;
        if (node.parentElement.closest(`[${BLUR_ATTR}]`)) return NodeFilter.FILTER_REJECT;
        if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const textNodes: Text[] = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

    for (const textNode of textNodes) {
      const text = textNode.textContent || '';
      const matches = findMatches(text, patterns);
      if (matches.length === 0) continue;
      this.wrapMatches(textNode, text, matches);
    }
  }

  private wrapMatches(textNode: Text, text: string, matches: MatchRange[]) {
    const fragment = document.createDocumentFragment();
    let lastEnd = 0;
    for (const { start, end } of matches) {
      if (start > lastEnd) {
        fragment.appendChild(document.createTextNode(text.slice(lastEnd, start)));
      }
      const span = document.createElement('span');
      span.className = BLUR_CLASS;
      span.setAttribute(BLUR_ATTR, 'regex');
      span.textContent = text.slice(start, end);
      span.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        span.classList.toggle(PEEK_CLASS);
      });
      fragment.appendChild(span);
      lastEnd = end;
    }
    if (lastEnd < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastEnd)));
    }
    textNode.parentNode?.replaceChild(fragment, textNode);
  }

  private blurInputFields(patterns: RegExp[]) {
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea'));
    for (const input of inputs) {
      if (input.getAttribute(BLUR_ATTR)) continue;
      const value = input.value;
      if (!value) continue;
      const matches = findMatches(value, patterns);
      if (matches.length > 0) {
        input.style.setProperty('filter', 'blur(10px)', 'important');
        input.setAttribute(BLUR_ATTR, 'input');
        input.addEventListener('mouseenter', () => input.style.removeProperty('filter'));
        input.addEventListener('mouseleave', () => input.style.setProperty('filter', 'blur(10px)', 'important'));
      }
    }
  }

  unblurAll() {
    const spans = Array.from(document.querySelectorAll(`span[${BLUR_ATTR}]`));
    for (const span of spans) {
      const text = document.createTextNode(span.textContent || '');
      span.parentNode?.replaceChild(text, span);
      text.parentNode?.normalize();
    }
    const blurredInputs = Array.from(document.querySelectorAll<HTMLElement>(`[${BLUR_ATTR}="input"]`));
    for (const input of blurredInputs) {
      input.style.removeProperty('filter');
      input.removeAttribute(BLUR_ATTR);
    }
    const manuals = Array.from(document.querySelectorAll('.mimik-manual-blur'));
    for (const el of manuals) {
      el.classList.remove('mimik-manual-blur');
    }
  }

  private observe() {
    this.observer = new MutationObserver(() => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.scan(), 400);
    });
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }
}
