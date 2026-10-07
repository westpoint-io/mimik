import { i18n } from '@/core/env';
import type { ElementMeta } from '@/core/guides/types';

type RoleTrait = 'typedInto' | 'pickedFrom' | 'namesItsHolder' | 'holdsControls' | 'endsTheSearch';

const ROLE_TRAITS: Record<string, readonly RoleTrait[]> = {
  textbox: ['typedInto', 'namesItsHolder'],
  searchbox: ['typedInto', 'namesItsHolder'],
  combobox: ['pickedFrom', 'namesItsHolder'],
  radio: ['pickedFrom', 'namesItsHolder'],
  option: ['pickedFrom'],
  menuitem: ['pickedFrom'],
  button: ['namesItsHolder'],
  checkbox: ['namesItsHolder'],
  link: ['namesItsHolder'],
  slider: ['namesItsHolder'],
  group: ['holdsControls'],
  pane: ['holdsControls', 'endsTheSearch'],
  window: ['endsTheSearch'],
  document: ['endsTheSearch'],
  application: ['endsTheSearch'],
};

const CHROMIUM_SURFACES = new Set(['chrome legacy window', 'intermediate d3d window', 'cefbrowserwindow']);
const NAME_LIMIT = 200;
const VALUE_LIMIT = 80;
const INVISIBLE = /[\p{Cf}\uFFFC\uFFFD]/gu;
const IDENTIFIER = /^(?=.*(?:[\d_.:[\]-]|[a-z][A-Z]))\S+$/;
const DIGITS_ONLY = /^\d+$/;

function hasTrait(role: string | null | undefined, trait: RoleTrait): boolean {
  return ROLE_TRAITS[role ?? '']?.includes(trait) ?? false;
}

interface NameCandidate {
  text: string;
  weight: number;
}

function nameCandidates(meta: ElementMeta): NameCandidate[] {
  const tidy = (value: string | null | undefined) => {
    const text = (value ?? '').replace(INVISIBLE, '').trim();
    const lower = text.toLowerCase();
    return lower.startsWith('chrome_') || CHROMIUM_SURFACES.has(lower) ? '' : text;
  };
  const role = meta.role;
  const shown = tidy(meta.textContent?.slice(0, VALUE_LIMIT));
  const shownIsLabel = !hasTrait(role, 'typedInto') && !(hasTrait(role, 'endsTheSearch') && DIGITS_ONLY.test(shown));
  const ownName = IDENTIFIER.test(meta.name ?? '') ? null : meta.name;
  const found: NameCandidate[] = [
    meta.ariaLabel,
    meta.placeholder,
    shownIsLabel ? shown : null,
    meta.altText,
    ownName,
  ].map((value, order) => ({ text: tidy(value), weight: 300 - order }));

  if (hasTrait(role, 'holdsControls')) {
    (meta.children ?? []).forEach((child, order) => {
      const kind = hasTrait(child.role, 'namesItsHolder') ? 200 : child.role === 'text' ? 100 : 0;
      if (kind > 0) found.push({ text: tidy(child.name), weight: kind - order / 1000 });
    });
  }

  for (const [depth, ancestor] of (meta.ancestors ?? []).entries()) {
    if (hasTrait(ancestor.role, 'endsTheSearch')) break;
    found.push({ text: tidy(ancestor.name), weight: 50 - depth / 1000 });
  }
  return found;
}

function elementName(meta: ElementMeta): string {
  let best: NameCandidate = { text: '', weight: Number.NEGATIVE_INFINITY };
  for (const candidate of nameCandidates(meta)) {
    if (candidate.text && candidate.weight > best.weight) best = candidate;
  }
  return best.text.slice(0, NAME_LIMIT);
}

export function buildFallbackDescription(action: string, meta: ElementMeta, typed?: string): string {
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
      if (hasTrait(meta.role, 'pickedFrom')) return i18n.t('steps.select', [name]);
      if (hasTrait(meta.role, 'typedInto')) return i18n.t('steps.enter', [name]);
      if (meta.href) return i18n.t('steps.clickLink', [name]);
      return i18n.t('steps.click', [name]);
    case 'input':
      if (meta.inputType === 'password') return i18n.t('steps.typeSecret');
      if (typed?.trim()) return i18n.t('steps.type', [typed.replace(/\s+/g, ' ').trim().slice(0, NAME_LIMIT)]);
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
