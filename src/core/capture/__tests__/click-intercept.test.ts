// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { replayClick, replayInit, shouldInterceptClick } from '@/core/capture/events/click-intercept';

function el(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host.firstElementChild as HTMLElement;
}

function click(over: Partial<MouseEventInit> & { isTrusted?: boolean } = {}): MouseEvent {
  return {
    isTrusted: true,
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    button: 0,
    buttons: 1,
    detail: 1,
    clientX: 40,
    clientY: 90,
    screenX: 0,
    screenY: 0,
    ...over,
  } as MouseEvent;
}

describe('shouldInterceptClick', () => {
  it('intercepts an ordinary button, which is the whole point', () => {
    expect(shouldInterceptClick(el('<button>Copy link</button>'), click())).toBe(true);
  });

  it('lets our own replayed click through untouched', () => {
    expect(shouldInterceptClick(el('<button>Copy link</button>'), click({ isTrusted: false }))).toBe(false);
  });

  it('steps aside for a shift-click so the real action can happen', () => {
    expect(shouldInterceptClick(el('<button>Copy link</button>'), click({ shiftKey: true }))).toBe(false);
  });

  it('leaves native dropdowns alone, which break when their click is blocked', () => {
    expect(shouldInterceptClick(el('<select><option>a</option></select>'), click())).toBe(false);
    expect(shouldInterceptClick(el('<option>a</option>'), click())).toBe(false);
  });

  it('leaves editable surfaces alone so the caret still lands', () => {
    const editable = el('<div contenteditable="true">notes</div>');
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    expect(shouldInterceptClick(editable, click())).toBe(false);
  });

  it('leaves text fields to the typing session', () => {
    expect(shouldInterceptClick(el('<input type="text">'), click())).toBe(false);
    expect(shouldInterceptClick(el('<textarea></textarea>'), click())).toBe(false);
  });

  it('lets native toggles through, since holding one back shoots the state it is leaving', () => {
    expect(shouldInterceptClick(el('<input type="checkbox">'), click())).toBe(false);
    expect(shouldInterceptClick(el('<input type="radio">'), click())).toBe(false);
  });

  it('lets aria toggles through the same way', () => {
    expect(shouldInterceptClick(el('<div role="checkbox" tabindex="0"></div>'), click())).toBe(false);
    expect(shouldInterceptClick(el('<button role="switch"></button>'), click())).toBe(false);
    expect(shouldInterceptClick(el('<div role="radio" tabindex="0"></div>'), click())).toBe(false);
  });

  it('still holds a checkbox inside a menu, which would close before the shot and take the box with it', () => {
    const menu = el('<div role="menu"><div role="menuitem" tabindex="0"><input type="checkbox"></div></div>');
    expect(shouldInterceptClick(menu.querySelector('input') as HTMLElement, click())).toBe(true);
  });

  it('lets a checkbox in a listbox through, since a multi-select stays open', () => {
    const list = el('<div role="listbox"><div role="option"><input type="checkbox"></div></div>');
    expect(shouldInterceptClick(list.querySelector('input') as HTMLElement, click())).toBe(false);
  });

  it('still holds a checkable menu item, whose menu closes on the click', () => {
    expect(shouldInterceptClick(el('<div role="menuitemcheckbox" tabindex="0"></div>'), click())).toBe(true);
  });
});

describe('replayInit', () => {
  it('carries the pointer position through to the replayed click', () => {
    const init = replayInit(click({ clientX: 120, clientY: 340 }));
    expect(init).toMatchObject({ clientX: 120, clientY: 340, bubbles: true, cancelable: true });
  });

  it('preserves the modifier keys the page may branch on', () => {
    const init = replayInit(click({ ctrlKey: true, metaKey: true, altKey: true, button: 1 }));
    expect(init).toMatchObject({ ctrlKey: true, metaKey: true, altKey: true, button: 1 });
  });

  it('reaches a delegated listener on the document as an untrusted click', () => {
    const button = el('<button>Copy link</button>');
    const seen: Array<{ trusted: boolean; x: number }> = [];
    document.addEventListener('click', (e) => seen.push({ trusted: e.isTrusted, x: (e as MouseEvent).clientX }), {
      once: true,
    });
    replayClick(button, replayInit(click({ clientX: 77 })));
    expect(seen).toEqual([{ trusted: false, x: 77 }]);
  });

  it('focuses the target first, the way a real click would', () => {
    const button = el('<button>Copy link</button>');
    replayClick(button, replayInit(click()));
    expect(document.activeElement).toBe(button);
  });
});
