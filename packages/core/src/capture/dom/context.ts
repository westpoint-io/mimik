import { isRedactedField } from './element-utils';

interface SiblingElement {
  tag: string;
  role: string | null;
  name: string | null;
  value: string | null;
}

export interface DOMContext {
  page: { title: string; path: string };
  container: { tag: string; role: string | null; label: string | null } | null;
  heading: string | null;
  siblings: SiblingElement[];
  target: { tag: string; role: string | null; name: string | null; value: string | null; action: string };
}

const SEMANTIC_CONTAINERS = new Set([
  'form',
  'nav',
  'dialog',
  'section',
  'main',
  'aside',
  'header',
  'footer',
  'article',
]);

const INTERACTIVE_SELECTOR =
  'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="radio"], [tabindex]:not([tabindex="-1"])';

const MAX_WALK_UP = 3;
const MAX_SIBLINGS = 10;

function textOf(el: Element | null): string | null {
  return el?.textContent?.trim() || null;
}

function attr(el: Element, name: string): string | null {
  return el.getAttribute(name) || null;
}

function resolveAriaLabelledBy(el: Element): string | null {
  const ids = attr(el, 'aria-labelledby');
  if (!ids) return null;
  return (
    ids
      .split(/\s+/)
      .map((id) => textOf(document.getElementById(id)))
      .filter(Boolean)
      .join(' ') || null
  );
}

function getLabelForInput(el: Element): string | null {
  const id = el.id;
  if (id) {
    const label = textOf(document.querySelector(`label[for="${CSS.escape(id)}"]`));
    if (label) return label;
  }
  const parentLabel = el.closest('label');
  if (!parentLabel) return null;
  const clone = parentLabel.cloneNode(true) as HTMLElement;
  for (const c of clone.querySelectorAll('input, select, textarea')) c.remove();
  return textOf(clone);
}

function getAccessibleName(el: Element): string | null {
  return (
    attr(el, 'aria-label') ??
    resolveAriaLabelledBy(el) ??
    (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
      ? getLabelForInput(el)
      : null) ??
    ((el.textContent?.trim()?.length ?? 0) <= 80 ? el.textContent?.trim() || null : null) ??
    attr(el, 'title') ??
    attr(el, 'placeholder')
  );
}

function getElementValue(el: Element): string | null {
  if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio'))
    return el.checked ? 'checked' : 'unchecked';
  if (el instanceof HTMLInputElement && el.type === 'password') return '***';
  if (isRedactedField(el)) return '***';
  if (el instanceof HTMLInputElement && el.value) return `value=${el.value.slice(0, 50)}`;
  if (el instanceof HTMLTextAreaElement && el.value) return `value=${el.value.slice(0, 50)}`;
  if (el instanceof HTMLSelectElement && el.selectedOptions.length)
    return `selected=${el.selectedOptions[0].text.slice(0, 50)}`;
  if (attr(el, 'aria-checked')) return attr(el, 'aria-checked') === 'true' ? 'checked' : 'unchecked';
  if (attr(el, 'aria-selected') === 'true') return 'selected';
  if (attr(el, 'aria-current')) return 'current';
  return null;
}

function getContainerLabel(el: Element): string | null {
  return (
    attr(el, 'aria-label') ?? textOf(el.querySelector(':scope > legend, :scope > caption')) ?? resolveAriaLabelledBy(el)
  );
}

function findContainer(el: Element): { tag: string; role: string | null; label: string | null } | null {
  let current = el.parentElement;
  for (
    let depth = 0;
    current && current !== document.body && depth < MAX_WALK_UP;
    depth++, current = current.parentElement
  ) {
    const tag = current.tagName.toLowerCase();
    const role = attr(current, 'role');
    if (SEMANTIC_CONTAINERS.has(tag) || role) {
      return { tag, role, label: getContainerLabel(current) };
    }
  }
  return null;
}

function findNearestHeading(el: Element): string | null {
  let current = el.parentElement;
  for (let depth = 0; current && current !== document.body && depth < 5; depth++, current = current.parentElement) {
    const text = textOf(current.querySelector('h1, h2, h3, h4, h5, h6, [role="heading"]'));
    if (text) return text.slice(0, 100);
  }

  let closest: Element | null = null;
  for (const h of document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')) {
    if (el.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_PRECEDING) closest = h;
    else break;
  }
  return closest ? (textOf(closest)?.slice(0, 100) ?? null) : null;
}

function collectSiblings(el: Element, container: Element | null): SiblingElement[] {
  const parent = container ?? el.parentElement;
  if (!parent) return [];

  const result: SiblingElement[] = [];
  for (const sib of parent.querySelectorAll(INTERACTIVE_SELECTOR)) {
    if (result.length >= MAX_SIBLINGS) break;
    if (sib.closest('[data-mimik-ignore]')) continue;
    result.push({
      tag: sib.tagName.toLowerCase(),
      role: attr(sib, 'role'),
      name: getAccessibleName(sib),
      value: getElementValue(sib),
    });
  }
  return result;
}

export function extractDOMContext(el: HTMLElement, action: string): DOMContext {
  const container = findContainer(el);
  const containerEl = container
    ? el.closest(`${container.tag}${container.role ? `[role="${container.role}"]` : ''}`)
    : null;

  return {
    page: { title: document.title, path: location.pathname },
    container,
    heading: findNearestHeading(el),
    siblings: collectSiblings(el, containerEl),
    target: {
      tag: el.tagName.toLowerCase(),
      role: attr(el, 'role'),
      name: getAccessibleName(el),
      value: getElementValue(el),
      action,
    },
  };
}

export function serializeDOMContext(ctx: DOMContext): string {
  const lines: string[] = [];

  lines.push(`Page: "${ctx.page.title}" ${ctx.page.path}`);

  if (ctx.container) {
    const role = ctx.container.role ? ` [role=${ctx.container.role}]` : '';
    const label = ctx.container.label ? ` "${ctx.container.label}"` : '';
    lines.push(`Container: ${ctx.container.tag}${role}${label}`);
  }

  lines.push(`Heading: ${ctx.heading ? `"${ctx.heading}"` : 'none'}`);

  if (ctx.siblings.length > 0) {
    lines.push(
      `Siblings: ${ctx.siblings
        .map((s) => {
          const name = s.name ? ` "${s.name}"` : '';
          const val = s.value ? ` [${s.value}]` : '';
          return `${s.tag}${name}${val}`;
        })
        .join(', ')}`,
    );
  }

  const { tag, name, value, action } = ctx.target;
  lines.push(`→ Target: ${tag}${name ? ` "${name}"` : ''}${value ? ` [${value}]` : ''} (${action})`);

  return lines.join('\n');
}
