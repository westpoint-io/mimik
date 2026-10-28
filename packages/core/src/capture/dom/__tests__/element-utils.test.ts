// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  eventTarget,
  findFocusableAncestor,
  getFieldLabel,
  getFieldValue,
  isSensitiveField,
  isTooLarge,
} from '../element-utils';

const VIEWPORT_WIDTH = 1000;
const VIEWPORT_HEIGHT = 800;

function makeElement(width: number, height: number): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({ x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height }),
  });
  return el;
}

describe('isTooLarge', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: VIEWPORT_WIDTH });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: VIEWPORT_HEIGHT });
  });

  it('reports a full-width banner as too large even when it is short', () => {
    expect(isTooLarge(makeElement(VIEWPORT_WIDTH, VIEWPORT_HEIGHT * 0.1))).toBe(true);
  });

  it('reports a full-height sidebar as too large even when it is narrow', () => {
    expect(isTooLarge(makeElement(VIEWPORT_WIDTH * 0.1, VIEWPORT_HEIGHT))).toBe(true);
  });

  it('reports a small element as not too large', () => {
    expect(isTooLarge(makeElement(120, 40))).toBe(false);
  });

  it('does not report an element sitting exactly at the 0.8 ratio', () => {
    expect(isTooLarge(makeElement(VIEWPORT_WIDTH * 0.8, VIEWPORT_HEIGHT * 0.8))).toBe(false);
  });

  it('reports an element just past the 0.8 width ratio', () => {
    expect(isTooLarge(makeElement(VIEWPORT_WIDTH * 0.81, 40))).toBe(true);
  });
});

describe('getFieldValue', () => {
  function makeInput(type: string, value: string): HTMLInputElement {
    const el = document.createElement('input');
    el.type = type;
    el.value = value;
    return el;
  }

  it('returns nothing for a password field so the typed value is never captured', () => {
    expect(getFieldValue(makeInput('password', 'hunter2'))).toBe('');
  });

  it('still returns the value for an ordinary text field', () => {
    expect(getFieldValue(makeInput('text', 'ada@example.com'))).toBe('ada@example.com');
  });

  it('returns the value for a contenteditable element', () => {
    const el = document.createElement('div');
    el.setAttribute('contenteditable', 'true');
    el.textContent = ' notes ';
    expect(getFieldValue(el)).toBe('notes');
  });
});

describe('isSensitiveField', () => {
  it('reports a password input as sensitive', () => {
    const el = document.createElement('input');
    el.type = 'password';
    expect(isSensitiveField(el)).toBe(true);
  });

  it('does not report a text input as sensitive', () => {
    const el = document.createElement('input');
    el.type = 'text';
    expect(isSensitiveField(el)).toBe(false);
  });

  it('does not report a textarea as sensitive', () => {
    expect(isSensitiveField(document.createElement('textarea'))).toBe(false);
  });
});

describe('eventTarget', () => {
  function retargeted(host: Element, inner: Element): Event {
    return { target: host, composedPath: () => [inner, host, document.body] } as unknown as Event;
  }

  it('returns the inner field rather than the web component wrapping it', () => {
    const host = document.createElement('faceplate-text-input');
    const inner = document.createElement('input');
    inner.type = 'password';
    expect(eventTarget(retargeted(host, inner))).toBe(inner);
  });

  it('leaves an ordinary target untouched', () => {
    const button = document.createElement('button');
    expect(eventTarget({ target: button, composedPath: () => [button] } as unknown as Event)).toBe(button);
  });

  it('falls back to target when composedPath is unavailable', () => {
    const button = document.createElement('button');
    expect(eventTarget({ target: button } as unknown as Event)).toBe(button);
  });

  it('returns null when there is no element to resolve', () => {
    expect(eventTarget({ target: null } as unknown as Event)).toBe(null);
  });
});

describe('findFocusableAncestor', () => {
  function wrappedInput(type: string) {
    const host = document.createElement('faceplate-text-input');
    const shadow = host.attachShadow({ mode: 'open' });
    const label = document.createElement('label');
    const outer = document.createElement('span');
    const decoration = document.createElement('span');
    const input = document.createElement('input');
    input.type = type;
    input.id = `field-${type}`;
    label.htmlFor = input.id;
    outer.appendChild(decoration);
    outer.appendChild(input);
    label.appendChild(outer);
    shadow.appendChild(label);
    document.body.appendChild(host);
    return { host, decoration, input };
  }

  it('resolves a decorative span inside a web component to the control it labels', () => {
    const { host, decoration, input } = wrappedInput('text');
    expect(findFocusableAncestor(decoration)).toBe(input);
    host.remove();
  });

  it('resolves to the password control so the sensitive guard sees it', () => {
    const { host, decoration, input } = wrappedInput('password');
    expect(findFocusableAncestor(decoration)).toBe(input);
    expect(isSensitiveField(findFocusableAncestor(decoration))).toBe(true);
    host.remove();
  });

  it('still returns the nearest focusable ancestor on an ordinary page', () => {
    const button = document.createElement('button');
    const span = document.createElement('span');
    button.appendChild(span);
    document.body.appendChild(button);
    expect(findFocusableAncestor(span)).toBe(button);
    button.remove();
  });

  it('resolves an ARIA option to itself rather than the tabIndex=-1 listbox wrapping it', () => {
    const list = document.createElement('div');
    list.setAttribute('role', 'listbox');
    list.tabIndex = -1;
    const option = document.createElement('div');
    option.setAttribute('role', 'option');
    const label = document.createElement('span');
    option.appendChild(label);
    list.appendChild(option);
    document.body.appendChild(list);

    expect(findFocusableAncestor(option)).toBe(option);
    expect(findFocusableAncestor(label)).toBe(option);
    list.remove();
  });

  function painted(el: Element) {
    Object.defineProperty(el, 'getBoundingClientRect', { value: () => ({ width: 20, height: 20 }) });
  }

  it('resolves a tree row to its treeitem rather than the focusable tree around it', () => {
    document.body.innerHTML =
      '<div role="tree" tabindex="1048"><ul><li role="treeitem"><div><span><div id="name">Sales orders</div></span></div></li></ul></div>';
    const item = document.querySelector('[role="treeitem"]');
    expect(findFocusableAncestor(document.getElementById('name')!)).toBe(item);
  });

  it('resolves a div button inside a focusable pane to the button', () => {
    document.body.innerHTML =
      '<div id="pane" tabindex="-1"><div id="btn" tabindex="9"><span>✓</span><span id="label">Save</span></div></div>';
    painted(document.getElementById('btn')!);
    expect(findFocusableAncestor(document.getElementById('label')!)).toBe(document.getElementById('btn'));
  });

  it('skips a focusable panel that holds several controls of its own', () => {
    document.body.innerHTML =
      '<div tabindex="-1"><span id="text">Posting</span><div tabindex="-1">Save</div><div tabindex="-1">Print</div></div>';
    for (const control of document.querySelectorAll('div div')) painted(control);
    const text = document.getElementById('text')!;
    expect(findFocusableAncestor(text)).toBe(text);
  });

  it('keeps a focusable menu item that carries its own tick box', () => {
    document.body.innerHTML =
      '<div id="item" tabindex="-1"><div role="checkbox"></div><span id="text">Toolbar</span></div>';
    painted(document.querySelector('[role="checkbox"]')!);
    expect(findFocusableAncestor(document.getElementById('text')!)).toBe(document.getElementById('item'));
  });

  it('ignores hidden controls when deciding whether a focusable element stands alone', () => {
    document.body.innerHTML =
      '<div id="trigger" aria-haspopup="menu"><span id="text">Edit</span><div role="menu"><div role="menuitem">Undo</div></div></div>';
    expect(findFocusableAncestor(document.getElementById('text')!)).toBe(document.getElementById('trigger'));
  });

  it('does not stretch a focusable pane over text nested deep inside it', () => {
    document.body.innerHTML =
      '<div tabindex="-1"><div><div><div><div><span id="leaf">Posting period 2026-09</span></div></div></div></div></div>';
    const leaf = document.getElementById('leaf')!;
    expect(findFocusableAncestor(leaf)).toBe(leaf);
  });
});

describe('getFieldLabel', () => {
  function slottedField(labelText: string) {
    const host = document.createElement('faceplate-text-input');
    host.textContent = labelText;
    const shadow = host.attachShadow({ mode: 'open' });
    const label = document.createElement('label');
    const marker = document.createElement('span');
    marker.textContent = '*';
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'slotted-field';
    label.htmlFor = input.id;
    label.appendChild(marker);
    label.appendChild(input);
    shadow.appendChild(label);
    document.body.appendChild(host);
    return { host, input };
  }

  it('uses the slotted host text rather than the required marker', () => {
    const { host, input } = slottedField('Email or username');
    expect(getFieldLabel(input)).toBe('Email or username');
    host.remove();
  });

  it('prefers an explicit aria-label over everything else', () => {
    const input = document.createElement('input');
    input.setAttribute('aria-label', 'Search');
    expect(getFieldLabel(input)).toBe('Search');
  });

  it('reads a label written in a script without Latin letters', () => {
    const label = document.createElement('label');
    label.textContent = '邮箱';
    const input = document.createElement('input');
    label.appendChild(input);
    document.body.appendChild(label);
    Object.defineProperty(label, 'innerText', { value: '邮箱' });
    expect(getFieldLabel(input)).toBe('邮箱');
    label.remove();
  });

  it('has no label of its own to offer when nothing names the field', () => {
    expect(getFieldLabel(document.createElement('input'))).toBeNull();
  });

  it('falls back to the name when nothing readable is available', () => {
    const input = document.createElement('input');
    input.setAttribute('name', 'username');
    expect(getFieldLabel(input)).toBe('username');
  });
});
