import type { ElementMeta, ElementNode } from '@/core/guides/types';

const ROLES = [
  null,
  'button',
  'checkbox',
  'combobox',
  'link',
  'radio',
  'searchbox',
  'slider',
  'textbox',
  'text',
  'group',
  'pane',
  'window',
  'document',
  'application',
  'menuitem',
  'menu',
  'tab',
  'option',
  'cell',
  'row',
  'treeitem',
  'image',
  'list',
  'listitem',
  'toolbar',
  'switch',
  'heading',
];

const NAMES = [
  null,
  '',
  'Save',
  'Sign in',
  'Country',
  '  Email  ',
  '42',
  '0',
  'SaveButton',
  'fl-post-111',
  'user_name',
  '​Invisible⁨ marks⁩',
  'A very long label that keeps going and going well beyond what anyone would read in a step title',
];

const ACTIONS = ['click', 'auxclick', 'input', 'keydown:Ctrl+S', 'copy', 'paste', 'drag'];

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return state / 2 ** 32;
  };
}

export interface NamingCase {
  action: string;
  meta: ElementMeta;
  typed?: string;
}

export function namingCases(count: number, seed: number): NamingCase[] {
  const next = seeded(seed);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!;
  const maybe = <T>(value: T, odds = 0.5): T | null => (next() < odds ? value : null);
  const nodes = (max: number): ElementNode[] =>
    Array.from({ length: Math.floor(next() * (max + 1)) }, () => ({ role: pick(ROLES), name: pick(NAMES) }));
  const cases: NamingCase[] = [];
  for (let i = 0; i < count; i++) {
    const role = pick(ROLES);
    const meta: ElementMeta = {
      source: pick(['dom', 'uia', 'ax', 'screen'] as const),
      role,
      ariaLabel: maybe(pick(NAMES), 0.35),
      placeholder: maybe(pick(NAMES), 0.2),
      textContent: maybe(pick(NAMES), 0.4),
      altText: maybe(pick(NAMES), 0.15),
      name: maybe(pick(NAMES), 0.3),
      tag: maybe(pick(['button', 'input', 'a', 'div', 'span']), 0.4) ?? undefined,
      inputType: maybe(pick(['checkbox', 'radio', 'text', 'password', 'email']), 0.2),
      href: maybe('https://example.com', 0.15),
      rect: { x: 0, y: 0, width: 10, height: 10 },
      devicePixelRatio: 1,
      ancestors: next() < 0.6 ? nodes(5) : undefined,
      children: next() < 0.6 ? nodes(6) : undefined,
    };
    cases.push({
      action: pick(ACTIONS),
      meta,
      typed: maybe(pick(['hello world', '  spaced   out  ', '']), 0.3) ?? undefined,
    });
  }
  return cases;
}
