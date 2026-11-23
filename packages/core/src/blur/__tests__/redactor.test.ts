// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { PageRedactor } from '../redactor';

const BLURRED = '.mimik-redact';

function scanWith(html: string): Document {
  document.body.innerHTML = html;
  const scanner = new PageRedactor();
  scanner.start(['email']);
  scanner.detach();
  return document;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('text node filtering', () => {
  it('blurs a match in real text', () => {
    scanWith('<p>Write to ada@example.com today</p>');
    expect(document.querySelectorAll(BLURRED)).toHaveLength(1);
    expect(document.querySelector(BLURRED)?.textContent).toBe('ada@example.com');
  });

  it('leaves text with no match alone', () => {
    scanWith('<p>Nothing sensitive here</p>');
    expect(document.querySelectorAll(BLURRED)).toHaveLength(0);
  });

  it('skips empty and whitespace-only nodes without throwing', () => {
    expect(() => scanWith('<p></p><p>   </p><p>\n\t </p><span></span>')).not.toThrow();
    expect(document.querySelectorAll(BLURRED)).toHaveLength(0);
  });

  it('still finds a match among empty and blank siblings', () => {
    scanWith('<p></p><p>   </p><p>ada@example.com</p><p> </p>');
    expect(document.querySelectorAll(BLURRED)).toHaveLength(1);
  });

  it('never walks into an excluded tag', () => {
    scanWith('<script>ada@example.com</script><style>bob@example.com</style><p>carol@example.com</p>');
    expect(document.querySelectorAll(BLURRED)).toHaveLength(1);
    expect(document.querySelector(BLURRED)?.textContent).toBe('carol@example.com');
  });

  it('does not blur inside something already blurred', () => {
    scanWith('<p>ada@example.com and bob@example.com</p>');
    const first = document.querySelectorAll(BLURRED).length;
    const scanner = new PageRedactor();
    scanner.start(['email']);
    scanner.detach();
    expect(document.querySelectorAll(BLURRED)).toHaveLength(first);
  });
});

describe('documented coverage limits', () => {
  it('does not reach into a shadow root', () => {
    document.body.innerHTML = '<div id="host"></div><p>carol@example.com</p>';
    const host = document.getElementById('host') as HTMLElement;
    host.attachShadow({ mode: 'open' }).innerHTML = '<p>ada@example.com</p>';

    const scanner = new PageRedactor();
    scanner.start(['email']);
    scanner.detach();

    expect(document.querySelectorAll(BLURRED)).toHaveLength(1);
    expect(document.querySelector(BLURRED)?.textContent).toBe('carol@example.com');
    expect(host.shadowRoot?.querySelectorAll(BLURRED)).toHaveLength(0);
  });

  it('does not blur select or option text', () => {
    scanWith('<select><option>ada@example.com</option></select>');
    expect(document.querySelectorAll(BLURRED)).toHaveLength(0);
  });

  it('does not blur a value held only in an attribute', () => {
    scanWith('<img alt="ada@example.com" src="x"><span title="bob@example.com">Hover</span>');
    expect(document.querySelectorAll(BLURRED)).toHaveLength(0);
  });

  it('does not blur text inside an iframe element', () => {
    scanWith('<iframe>ada@example.com</iframe>');
    expect(document.querySelectorAll(BLURRED)).toHaveLength(0);
  });

  it('does blur svg text, which is made of real text nodes', () => {
    scanWith('<svg><text>ada@example.com</text></svg>');
    expect(document.querySelectorAll(BLURRED)).toHaveLength(1);
  });

  it('blurs a whole matching input rather than the matched substring', () => {
    document.body.innerHTML = '<input value="reach me at ada@example.com ok">';
    const scanner = new PageRedactor();
    scanner.start(['email']);
    scanner.detach();

    const input = document.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('data-mimik-redact')).toBe('field');
    expect(input.style.filter).toContain('blur');
    expect(document.querySelectorAll(BLURRED)).toHaveLength(0);
  });
});

describe('peeking under a mask', () => {
  function click(el: Element) {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    return event;
  }

  it('lifts the blur on a click while the blur panel is open', () => {
    document.body.innerHTML = '<input value="ada@example.com">';
    const field = document.querySelector('input') as HTMLInputElement;
    const scanner = new PageRedactor();
    scanner.start(['email']);

    expect(click(field).defaultPrevented).toBe(true);
    expect(field.style.filter).toBe('');
    scanner.detach();
  });

  it('puts every peeked mask back when the panel closes', () => {
    document.body.innerHTML = '<p>ada@example.com</p><input value="bob@example.com">';
    const field = document.querySelector('input') as HTMLInputElement;
    const scanner = new PageRedactor();
    scanner.start(['email']);
    click(field);
    click(document.querySelector(BLURRED) as Element);

    scanner.detach();

    expect(field.style.filter).toBe('blur(10px)');
    expect(document.querySelector(BLURRED)?.classList.contains('mimik-redact-shown')).toBe(false);
  });

  it('lets a click through and keeps the blur once the panel is closed, as while recording', () => {
    document.body.innerHTML = '<input value="ada@example.com">';
    const field = document.querySelector('input') as HTMLInputElement;
    const scanner = new PageRedactor();
    scanner.start(['email']);
    scanner.detach();

    expect(click(field).defaultPrevented).toBe(false);
    expect(field.style.filter).toBe('blur(10px)');
  });
});
