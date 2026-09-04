export const FOCUSABLE_SELECTOR =
  'a[href], button, input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="radio"], [tabindex], [contenteditable="true"]';

const MAX_ELEMENT_RATIO = 0.8;

export function findFocusableAncestor(el: Element): HTMLElement {
  let cursor: Element | null = el;
  while (cursor) {
    const match: Element | null = cursor.closest(FOCUSABLE_SELECTOR);
    if (match instanceof HTMLElement) return match;
    if (match) {
      cursor = match.parentElement;
      continue;
    }
    break;
  }
  if (el instanceof HTMLElement) return el;
  let parent: Element | null = el.parentElement;
  while (parent && !(parent instanceof HTMLElement)) {
    parent = parent.parentElement;
  }
  return (parent as HTMLElement) ?? document.body;
}

export function isTextField(el: Element): boolean {
  if (el instanceof HTMLInputElement) {
    return ['text', 'email', 'password', 'search', 'tel', 'url', 'number'].includes(el.type);
  }
  return el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable);
}

const TOGGLE_ROLES = new Set(['checkbox', 'radio', 'switch']);
const TOGGLE_INPUT_TYPES = new Set(['checkbox', 'radio']);

function isToggleInput(el: Element | null): el is HTMLInputElement {
  return el instanceof HTMLInputElement && TOGGLE_INPUT_TYPES.has(el.type);
}

/**
 * A click whose whole visible effect is the control flipping state: a checkbox,
 * a radio, an aria switch, or a label that drives one. The step is worth showing
 * settled rather than mid-flip, so these are captured after the toggle lands.
 */
export function isToggleControl(el: HTMLElement): boolean {
  if (isToggleInput(el)) return true;

  const role = el.getAttribute('role');
  if (role && TOGGLE_ROLES.has(role)) return true;

  const label = el instanceof HTMLLabelElement ? el : el.closest('label');
  if (!label) return false;
  const control = label.control ?? (label.htmlFor ? label.ownerDocument.getElementById(label.htmlFor) : null);
  return isToggleInput(control);
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

export function getFieldValue(el: HTMLElement): string {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.value;
  if (el.isContentEditable) return el.textContent?.trim() ?? '';
  return '';
}

export function getFieldLabel(el: HTMLElement): string {
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  const placeholder = el.getAttribute('placeholder');
  if (placeholder) return placeholder;

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const labels = el.labels;
    if (labels && labels.length > 0) {
      const labelText = labels[0].innerText?.trim();
      if (labelText) return labelText;
    }
  }

  const id = el.getAttribute('id');
  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label) {
      const labelText = (label as HTMLElement).innerText?.trim();
      if (labelText) return labelText;
    }
  }

  const parentLabel = el.closest('label');
  if (parentLabel) {
    const labelText = parentLabel.innerText?.trim();
    if (labelText) return labelText;
  }

  const name = el.getAttribute('name');
  if (name && !/[-_]test|[-_]id|[-_]key/i.test(name)) return name;

  return 'text field';
}
