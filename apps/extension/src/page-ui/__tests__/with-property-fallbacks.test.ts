import { describe, expect, it } from 'vitest';
import { withPropertyFallbacks } from '../with-property-fallbacks';

describe('withPropertyFallbacks', () => {
  it('gives every registered property its initial value inside the first layer', () => {
    const css = [
      '@layer properties;',
      '@property --tw-shadow { syntax: "*"; inherits: false; initial-value: 0 0 #0000; }',
      '@property --tw-rotate-x { syntax: "*"; inherits: false; }',
      '.shadow { box-shadow: var(--tw-shadow); }',
    ].join('\n');

    const out = withPropertyFallbacks(css);

    expect(out).toContain('@layer properties {\n  :host, *, ::before, ::after, ::backdrop { --tw-shadow: 0 0 #0000; }');
    expect(out).not.toContain('--tw-rotate-x:');
  });

  it('leaves a stylesheet without registered properties alone', () => {
    expect(withPropertyFallbacks('.a { color: red; }')).toBe('.a { color: red; }');
  });
});
