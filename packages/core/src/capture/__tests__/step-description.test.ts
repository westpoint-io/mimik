import { describe, expect, it } from 'vitest';
import type { ElementMeta } from '@/core/guides/types';
import { buildFallbackDescription } from '../step-description';

function makeMeta(overrides: Partial<ElementMeta> = {}): ElementMeta {
  return {
    tag: 'button',
    textContent: null,
    ariaLabel: null,
    placeholder: null,
    altText: null,
    name: null,
    role: null,
    href: null,
    inputType: null,
    cssSelector: 'button.submit',
    dataTestId: null,
    rect: { x: 0, y: 0, width: 0, height: 0 },
    devicePixelRatio: 1,
    ...overrides,
  };
}

describe('buildFallbackDescription', () => {
  it('generates click description using textContent', () => {
    const result = buildFallbackDescription('click', makeMeta({ textContent: 'Submit' }));
    expect(result).toBe('steps.click[Submit]');
  });

  it('generates click link description when href is present', () => {
    const result = buildFallbackDescription('click', makeMeta({ textContent: 'Home', href: '/home' }));
    expect(result).toBe('steps.clickLink[Home]');
  });

  it('generates checkbox toggle for input[type=checkbox]', () => {
    const result = buildFallbackDescription(
      'click',
      makeMeta({ tag: 'input', inputType: 'checkbox', ariaLabel: 'Accept terms' }),
    );
    expect(result).toBe('steps.toggleCheckbox[Accept terms]');
  });

  it('generates radio select for input[type=radio]', () => {
    const result = buildFallbackDescription(
      'click',
      makeMeta({ tag: 'input', inputType: 'radio', ariaLabel: 'Option A' }),
    );
    expect(result).toBe('steps.select[Option A]');
  });

  it('generates switch toggle for role=switch', () => {
    const result = buildFallbackDescription('click', makeMeta({ role: 'switch', ariaLabel: 'Dark mode' }));
    expect(result).toBe('steps.toggleSwitch[Dark mode]');
  });

  it('generates type description with input type', () => {
    const result = buildFallbackDescription('input', makeMeta({ inputType: 'email', placeholder: 'Email' }));
    expect(result).toBe('steps.typeIntoField[email,Email]');
  });

  it('generates generic type description without input type', () => {
    const result = buildFallbackDescription('input', makeMeta({ ariaLabel: 'Search' }));
    expect(result).toBe('steps.typeInto[Search]');
  });

  it('generates navigate description', () => {
    const result = buildFallbackDescription('navigate', makeMeta());
    expect(result).toBe('steps.navigate');
  });

  it('generates keydown description', () => {
    const result = buildFallbackDescription('keydown:Enter', makeMeta({ ariaLabel: 'Search field' }));
    expect(result).toBe('steps.pressKey[Enter,Search field]');
  });

  it('generates copy description', () => {
    const result = buildFallbackDescription('copy', makeMeta({ ariaLabel: 'Code block' }));
    expect(result).toBe('steps.copyFrom[Code block]');
  });

  it('generates paste description', () => {
    const result = buildFallbackDescription('paste', makeMeta({ ariaLabel: 'Input field' }));
    expect(result).toBe('steps.pasteInto[Input field]');
  });

  it('generates drag description', () => {
    const result = buildFallbackDescription('drag', makeMeta({ ariaLabel: 'Card' }));
    expect(result).toBe('steps.drag[Card]');
  });

  it('says click here when nothing names the element', () => {
    const result = buildFallbackDescription('click', makeMeta({ tag: 'div' }));
    expect(result).toBe('steps.clickHere');
  });

  it('says right-click here when nothing names the element', () => {
    expect(buildFallbackDescription('auxclick', makeMeta({ tag: 'div' }))).toBe('steps.rightClickHere');
  });

  it('uses default action for unknown actions', () => {
    const result = buildFallbackDescription('focus', makeMeta({ ariaLabel: 'Menu' }));
    expect(result).toBe('steps.defaultAction[focus,Menu]');
  });

  it('prefers ariaLabel over textContent', () => {
    const result = buildFallbackDescription('click', makeMeta({ ariaLabel: 'Close dialog', textContent: 'X' }));
    expect(result).toBe('steps.click[Close dialog]');
  });

  it('truncates long textContent to 80 chars', () => {
    const longText = 'A'.repeat(100);
    const result = buildFallbackDescription('click', makeMeta({ textContent: longText }));
    expect(result).toBe(`steps.click[${'A'.repeat(80)}]`);
  });
});

describe('accessibility-tree sources', () => {
  function axMeta(overrides: Partial<ElementMeta> = {}): ElementMeta {
    return {
      source: 'ax',
      textContent: null,
      ariaLabel: null,
      placeholder: null,
      altText: null,
      name: null,
      role: null,
      rect: { x: 0, y: 0, width: 0, height: 0 },
      devicePixelRatio: 2,
      app: { name: 'Excel', id: 'com.microsoft.Excel' },
      window: { title: 'Budget.xlsx' },
      ...overrides,
    };
  }

  it('describes a click with no DOM fields at all', () => {
    expect(buildFallbackDescription('click', axMeta({ name: 'Save' }))).toBe('steps.click[Save]');
  });

  it('reaches the same checkbox wording through role as the DOM does through tag', () => {
    const viaRole = buildFallbackDescription('click', axMeta({ role: 'checkbox', name: 'Wrap text' }));
    const viaTag = buildFallbackDescription(
      'click',
      makeMeta({ tag: 'input', inputType: 'checkbox', ariaLabel: 'Wrap text' }),
    );
    expect(viaRole).toBe('steps.toggleCheckbox[Wrap text]');
    expect(viaTag).toBe(viaRole);
  });

  it('says click here rather than naming the control type', () => {
    expect(buildFallbackDescription('click', axMeta({ role: 'button' }))).toBe('steps.clickHere');
  });

  it('enters a text field and never names it by what is typed in it', () => {
    const meta = axMeta({ role: 'textbox', textContent: 'hello', altText: 'Search' });
    expect(buildFallbackDescription('click', meta)).toBe('steps.enter[Search]');
  });

  it('selects from combo boxes, radio buttons and menu items', () => {
    for (const role of ['combobox', 'radio', 'menuitem']) {
      expect(buildFallbackDescription('click', axMeta({ role, ariaLabel: 'Font' }))).toBe('steps.select[Font]');
    }
  });

  it('names an unnamed group after the control inside it before any text', () => {
    const meta = axMeta({
      role: 'group',
      children: [
        { role: 'text', name: 'Caption' },
        { role: 'button', name: 'Save' },
      ],
    });
    expect(buildFallbackDescription('click', meta)).toBe('steps.click[Save]');
  });

  it('borrows the nearest named ancestor but stops at the window', () => {
    const inside = axMeta({
      role: 'img',
      ancestors: [
        { role: 'group', name: null },
        { role: 'listitem', name: 'Pictures' },
      ],
    });
    const outside = axMeta({ role: 'img', ancestors: [{ role: 'window', name: 'File Explorer' }] });
    expect(buildFallbackDescription('click', inside)).toBe('steps.click[Pictures]');
    expect(buildFallbackDescription('click', outside)).toBe('steps.clickHere');
  });

  it('ignores host window names and bare numbers on panes', () => {
    expect(buildFallbackDescription('click', axMeta({ role: 'pane', ariaLabel: 'Chrome Legacy Window' }))).toBe(
      'steps.clickHere',
    );
    expect(buildFallbackDescription('click', axMeta({ role: 'pane', textContent: '42' }))).toBe('steps.clickHere');
  });

  it('never names a control by an identifier', () => {
    for (const name of ['fl-post-111', 'SaveButton', 'btn_submit', 'item3']) {
      expect(buildFallbackDescription('click', axMeta({ role: 'button', name }))).toBe('steps.clickHere');
    }
    expect(buildFallbackDescription('click', axMeta({ role: 'button', name: 'Save' }))).toBe('steps.click[Save]');
  });

  it('names what was typed when the value is known', () => {
    const meta = axMeta({ role: 'textbox', ariaLabel: 'Search box' });
    expect(buildFallbackDescription('input', meta, '  noticias\nde   hoy ')).toBe('steps.type[noticias de hoy]');
    expect(buildFallbackDescription('input', meta)).toBe('steps.typeInto[Search box]');
    expect(buildFallbackDescription('input', { ...meta, inputType: 'password' }, 'hunter2')).toBe('steps.typeSecret');
  });

  it('drops invisible characters from names', () => {
    const meta = axMeta({ role: 'link', ariaLabel: '\u2068Policía\u2069 \u2068abate\u200b\u2069' });
    expect(buildFallbackDescription('click', meta)).toBe('steps.click[Policía abate]');
  });

  it('describes typing without an inputType', () => {
    expect(buildFallbackDescription('input', axMeta({ name: 'Cell B4' }))).toBe('steps.typeInto[Cell B4]');
  });
});
