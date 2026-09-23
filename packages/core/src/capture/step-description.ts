import { i18n } from '@/core/env';
import type { ElementMeta, ElementNode } from '@/core/guides/types';

const FIELD_ROLES = new Set(['textbox', 'searchbox']);
const SELECT_ROLES = new Set(['combobox', 'radio', 'menuitem', 'option']);
const CONTAINER_ROLES = new Set(['group', 'pane']);
const OUTER_ROLES = new Set(['document', 'window', 'pane', 'application']);
const CHILD_ROLES = new Set(['textbox', 'searchbox', 'combobox', 'button', 'link', 'checkbox', 'radio', 'slider']);
const HOST_WINDOW =
  /^(Chrome_RenderWidgetHostHWND|Chrome_WidgetWin_\d*|CefBrowserWindow|Intermediate D3D Window|Chrome Legacy Window)$/i;
const MAX_NAME = 200;

function elementName(meta: ElementMeta): string {
  const clean = (value: string | null | undefined) => {
    const text = value?.trim() ?? '';
    return HOST_WINDOW.test(text) ? '' : text;
  };
  const role = meta.role ?? '';
  const value = clean(meta.textContent?.slice(0, 80));
  const shown = OUTER_ROLES.has(role) && /^\d+$/.test(value) ? '' : value;
  const own = FIELD_ROLES.has(role)
    ? clean(meta.ariaLabel) || clean(meta.placeholder) || clean(meta.altText) || clean(meta.name)
    : clean(meta.ariaLabel) || clean(meta.placeholder) || shown || clean(meta.altText) || clean(meta.name);
  if (own) return own.slice(0, MAX_NAME);

  const named = (node: ElementNode | undefined) => clean(node?.name);
  if (CONTAINER_ROLES.has(role)) {
    const child =
      meta.children?.find((node) => CHILD_ROLES.has(node.role ?? '') && named(node)) ??
      meta.children?.find((node) => node.role === 'text' && named(node));
    if (child) return named(child).slice(0, MAX_NAME);
  }
  for (const ancestor of meta.ancestors ?? []) {
    if (OUTER_ROLES.has(ancestor.role ?? '')) break;
    if (named(ancestor)) return named(ancestor).slice(0, MAX_NAME);
  }
  return '';
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
      if (SELECT_ROLES.has(meta.role ?? '')) return i18n.t('steps.select', [name]);
      if (FIELD_ROLES.has(meta.role ?? '')) return i18n.t('steps.enter', [name]);
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
