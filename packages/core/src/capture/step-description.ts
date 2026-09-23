import { i18n } from '@/core/env';
import type { ElementMeta, ElementNode } from '@/core/guides/types';

const VERB_BY_ROLE: Record<string, 'enter' | 'select'> = {
  combobox: 'select',
  menuitem: 'select',
  option: 'select',
  radio: 'select',
  searchbox: 'enter',
  textbox: 'enter',
};
const WRAPPERS = new Set(['group', 'pane']);
const BOUNDARIES = new Set(['application', 'document', 'pane', 'window']);
const LABELLING_CONTROLS = new Set([
  'button',
  'checkbox',
  'combobox',
  'link',
  'radio',
  'searchbox',
  'slider',
  'textbox',
]);
const HOST_SURFACES = new Set([
  'cefbrowserwindow',
  'chrome legacy window',
  'chrome_renderwidgethosthwnd',
  'intermediate d3d window',
]);
const NAME_LIMIT = 200;

function elementName(meta: ElementMeta): string {
  const usable = (value: string | null | undefined) => {
    const text = (value ?? '').trim();
    const lower = text.toLowerCase();
    return HOST_SURFACES.has(lower) || lower.startsWith('chrome_widgetwin_') ? '' : text;
  };
  const role = meta.role ?? '';
  const value = usable(meta.textContent?.slice(0, 80));
  const hideValue = VERB_BY_ROLE[role] === 'enter' || (BOUNDARIES.has(role) && /^\d+$/.test(value));
  const own = [meta.ariaLabel, meta.placeholder, hideValue ? null : value, meta.altText, meta.name]
    .map(usable)
    .find(Boolean);
  if (own) return own.slice(0, NAME_LIMIT);

  const rank = (node: ElementNode) => (LABELLING_CONTROLS.has(node.role ?? '') ? 0 : node.role === 'text' ? 1 : 2);
  const inside = WRAPPERS.has(role)
    ? (meta.children ?? []).filter((node) => rank(node) < 2 && usable(node.name)).sort((a, b) => rank(a) - rank(b))[0]
    : undefined;
  if (inside) return usable(inside.name).slice(0, NAME_LIMIT);

  const ancestors = meta.ancestors ?? [];
  const boundary = ancestors.findIndex((node) => BOUNDARIES.has(node.role ?? ''));
  const around = (boundary === -1 ? ancestors : ancestors.slice(0, boundary)).find((node) => usable(node.name));
  return around ? usable(around.name).slice(0, NAME_LIMIT) : '';
}

export function buildFallbackDescription(action: string, meta: ElementMeta): string {
  const name = elementName(meta);
  const target = name || meta.role || meta.tag || '';

  if (action.startsWith('keydown:')) {
    const key = action.split(':')[1];
    return i18n.t('steps.pressKey', [key, target]);
  }

  switch (action) {
    case 'auxclick':
      return name ? i18n.t('steps.rightClick', [name]) : i18n.t('steps.rightClickHere');
    case 'click':
      if (!name) return i18n.t('steps.clickHere');
      if (meta.tag === 'input' && meta.inputType === 'checkbox') return i18n.t('steps.toggleCheckbox', [name]);
      if (meta.tag === 'input' && meta.inputType === 'radio') return i18n.t('steps.select', [name]);
      if (meta.role === 'switch') return i18n.t('steps.toggleSwitch', [name]);
      if (meta.role === 'checkbox') return i18n.t('steps.toggleCheckbox', [name]);
      if (VERB_BY_ROLE[meta.role ?? ''] === 'select') return i18n.t('steps.select', [name]);
      if (VERB_BY_ROLE[meta.role ?? ''] === 'enter') return i18n.t('steps.enter', [name]);
      if (meta.href) return i18n.t('steps.clickLink', [name]);
      return i18n.t('steps.click', [name]);
    case 'input':
      if (meta.inputType === 'password') return i18n.t('steps.typeSecret');
      if (meta.inputType) return i18n.t('steps.typeIntoField', [meta.inputType, target]);
      return i18n.t('steps.typeInto', [target]);
    case 'copy':
      return i18n.t('steps.copyFrom', [target]);
    case 'paste':
      return i18n.t('steps.pasteInto', [target]);
    case 'cut':
      return i18n.t('steps.cutFrom', [target]);
    case 'drag':
      return i18n.t('steps.drag', [target]);
    case 'navigate':
      return i18n.t('steps.navigate');
    default:
      return i18n.t('steps.defaultAction', [action, target]);
  }
}
