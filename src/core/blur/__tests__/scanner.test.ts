// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { BlurScanner } from '../scanner';

const BLURRED = '.mimik-blur';

function scanWith(html: string): Document {
  document.body.innerHTML = html;
  const scanner = new BlurScanner();
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
    const scanner = new BlurScanner();
    scanner.start(['email']);
    scanner.detach();
    expect(document.querySelectorAll(BLURRED)).toHaveLength(first);
  });
});
