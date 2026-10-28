import { REDACT_ATTR } from '../../blur/redactor';

const SEMANTIC_SELECTOR =
  'a[href], button, input, select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="checkbox"], [role="radio"], [role="switch"], [role="option"], [role="treeitem"], [role="gridcell"], [role="columnheader"], [role="combobox"], [contenteditable="true"]';

const WEAK_SELECTOR = '[tabindex], [aria-haspopup]';

const CONTROL_SELECTOR = `${SEMANTIC_SELECTOR}, ${WEAK_SELECTOR}`;

const MAX_WEAK_DEPTH = 4;

const MAX_ROW_LABEL_LENGTH = 40;

const MAX_ELEMENT_RATIO = 0.8;

function isPainted(el: Element): boolean {
  const { width, height } = el.getBoundingClientRect();
  return width > 0 && height > 0;
}

function holdsSeveralControls(el: Element): boolean {
  let painted = 0;
  for (const inner of el.querySelectorAll(CONTROL_SELECTOR)) {
    if (isPainted(inner) && ++painted > 1) return true;
  }
  return false;
}

function labelledControl(el: Element): HTMLElement | null {
  const label = el.closest('label');
  return label instanceof HTMLLabelElement && label.control instanceof HTMLElement ? label.control : null;
}

function shadowHost(el: Element): Element | null {
  const root = el.getRootNode();
  return root instanceof ShadowRoot && root.host instanceof Element ? root.host : null;
}

export function findFocusableAncestor(el: Element): HTMLElement {
  let weak: HTMLElement | null = null;
  let scope: Element | null = el;
  while (scope) {
    let depth = 0;
    for (let cursor: Element | null = scope; cursor; cursor = cursor.parentElement, depth++) {
      if (!(cursor instanceof HTMLElement)) continue;
      if (cursor.matches(SEMANTIC_SELECTOR)) return cursor;
      if (!weak && depth <= MAX_WEAK_DEPTH && cursor.matches(WEAK_SELECTOR) && !holdsSeveralControls(cursor))
        weak = cursor;
    }
    const control = labelledControl(scope);
    if (control) return control;
    scope = shadowHost(scope);
  }
  if (weak) return weak;
  if (el instanceof HTMLElement) return el;
  let parent: Element | null = el.parentElement;
  while (parent && !(parent instanceof HTMLElement)) {
    parent = parent.parentElement;
  }
  return (parent as HTMLElement) ?? document.body;
}

export function isTextField(el: Element): boolean {
  if (el instanceof HTMLInputElement) {
    return (
      !el.readOnly && !el.disabled && ['text', 'email', 'password', 'search', 'tel', 'url', 'number'].includes(el.type)
    );
  }
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  return el instanceof HTMLElement && el.isContentEditable;
}

const TOGGLE_ROLES = new Set(['checkbox', 'radio', 'switch']);

export function isToggle(el: Element): boolean {
  if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) return true;
  return TOGGLE_ROLES.has(el.getAttribute('role') ?? '');
}

export function isNavigatingClick(el: HTMLElement): boolean {
  const anchor = el.closest('a[href]');
  if (!anchor) return false;
  const href = anchor.getAttribute('href');
  return !(!href || href === '#' || href.startsWith('javascript:'));
}

export function isTooLarge(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  return rect.width / window.innerWidth > MAX_ELEMENT_RATIO || rect.height / window.innerHeight > MAX_ELEMENT_RATIO;
}

export function isMimikElement(el: Element): boolean {
  return !!el.closest('[data-mimik-ignore]');
}

export function isSensitiveField(el: Element | null): boolean {
  return el instanceof HTMLInputElement && el.type === 'password';
}

export function isRedactedField(el: Element | null): boolean {
  return el instanceof Element && !!el.closest(`[${REDACT_ATTR}]`);
}

export function eventTarget(e: Event): Element | null {
  const inner = e.composedPath?.()[0];
  if (inner instanceof Element) return inner;
  return e.target instanceof Element ? e.target : null;
}

export function getFieldValue(el: HTMLElement): string {
  if (isSensitiveField(el)) return '';
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.value;
  if (el.isContentEditable) return el.textContent?.trim() ?? '';
  return '';
}

const READABLE = /[\p{L}\p{N}]/u;

function meaningfulLabel(text: string | null | undefined): string | null {
  const trimmed = text?.trim();
  if (!trimmed || !READABLE.test(trimmed)) return null;
  return (
    trimmed
      .split('\n')
      .map((line) => line.trim())
      .find((line) => READABLE.test(line)) ?? null
  );
}

function slottedLabel(el: Element): string | null {
  const host = shadowHost(el);
  if (!host) return null;
  return (
    meaningfulLabel(host.getAttribute('aria-label')) ??
    meaningfulLabel(host.getAttribute('label')) ??
    meaningfulLabel((host as HTMLElement).textContent)
  );
}

function rowLabel(el: HTMLElement): string | null {
  const row = el.parentElement;
  if (!row) return null;
  for (const control of row.querySelectorAll(CONTROL_SELECTOR)) {
    if (control !== el && !el.contains(control) && isPainted(control)) return null;
  }
  const text = meaningfulLabel(row.innerText);
  return text && text.length <= MAX_ROW_LABEL_LENGTH ? text : null;
}

export function getFieldLabel(el: HTMLElement): string | null {
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  const placeholder = el.getAttribute('placeholder');
  if (placeholder) return placeholder;

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const labels = el.labels;
    if (labels && labels.length > 0) {
      const labelText = meaningfulLabel(labels[0]!.innerText);
      if (labelText) return labelText;
    }
  }

  const slotted = slottedLabel(el);
  if (slotted) return slotted;

  const id = el.getAttribute('id');
  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label) {
      const labelText = meaningfulLabel((label as HTMLElement).innerText);
      if (labelText) return labelText;
    }
  }

  const parentLabel = el.closest('label');
  if (parentLabel) {
    const labelText = meaningfulLabel(parentLabel.innerText);
    if (labelText) return labelText;
  }

  const row = rowLabel(el);
  if (row) return row;

  const name = el.getAttribute('name');
  if (name && !/[-_]test|[-_]id|[-_]key/i.test(name)) return name;

  return null;
}
