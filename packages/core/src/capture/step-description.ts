import { i18n } from '@/core/env';
import type { ElementMeta } from '@/core/guides/types';

export function buildFallbackDescription(action: string, meta: ElementMeta): string {
  const target =
    meta.ariaLabel ||
    meta.placeholder ||
    meta.textContent?.slice(0, 80) ||
    meta.altText ||
    meta.name ||
    meta.role ||
    meta.tag ||
    '';

  if (action.startsWith('keydown:')) {
    const key = action.split(':')[1];
    return i18n.t('steps.pressKey', [key, target]);
  }

  switch (action) {
    case 'click':
    case 'auxclick':
      if (meta.tag === 'input' && meta.inputType === 'checkbox') return i18n.t('steps.toggleCheckbox', [target]);
      if (meta.tag === 'input' && meta.inputType === 'radio') return i18n.t('steps.selectRadio', [target]);
      if (meta.role === 'switch') return i18n.t('steps.toggleSwitch', [target]);
      if (meta.role === 'checkbox') return i18n.t('steps.toggleCheckbox', [target]);
      if (meta.role === 'radio') return i18n.t('steps.selectRadio', [target]);
      if (meta.href) return i18n.t('steps.clickLink', [target]);
      return i18n.t('steps.click', [target]);
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
