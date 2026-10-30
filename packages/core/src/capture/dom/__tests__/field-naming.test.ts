// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { buildFallbackDescription } from '../../step-description';
import { extractElementMeta } from '../element-meta';
import { getFieldLabel, isTextField } from '../element-utils';

function field(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.getElementById('field')!;
}

function painted(el: Element) {
  Object.defineProperty(el, 'getBoundingClientRect', { value: () => ({ width: 20, height: 20 }) });
}

describe('naming a field when it is clicked', () => {
  it('names the field after its label before anything is typed', () => {
    const meta = extractElementMeta(field('<label for="field">Customer</label><input id="field">'));
    expect(buildFallbackDescription('input', meta)).toContain('Customer');
  });

  it('names a field after its row when no label is linked to it', () => {
    const el = field('<div><span><label tabindex="-1"><pre>Article</pre></label></span><input id="field"></div>');
    expect(getFieldLabel(el)).toBe('Article');
  });

  it('does not borrow the row text when the row holds another control', () => {
    const el = field('<div>Search<input id="field"><button>Go</button></div>');
    painted(document.querySelector('button')!);
    expect(getFieldLabel(el)).toBe(null);
  });

  it('does not borrow a long run of row text', () => {
    const el = field(`<div>${'A paragraph about the field '.repeat(3)}<input id="field"></div>`);
    expect(getFieldLabel(el)).toBe(null);
  });
});

describe('readonly inputs', () => {
  it('records a readonly picker as a click named after its value', () => {
    const el = field('<div><input id="field" readonly value="Standard"><div>▾</div></div>');
    expect(isTextField(el)).toBe(false);
    expect(buildFallbackDescription('click', extractElementMeta(el))).toContain('Standard');
  });

  it('treats a disabled input and a readonly textarea as clicks', () => {
    expect(isTextField(field('<input id="field" disabled>'))).toBe(false);
    expect(isTextField(field('<textarea id="field" readonly></textarea>'))).toBe(false);
    expect(isTextField(field('<input id="field">'))).toBe(true);
  });

  it('never stores the value of a readonly password', () => {
    const meta = extractElementMeta(field('<input id="field" type="password" readonly value="hunter2">'));
    expect(JSON.stringify(meta)).not.toContain('hunter2');
  });
});
