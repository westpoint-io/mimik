import { describe, expect, it } from 'vitest';
import { getDomainInitial } from '../domain-initial';

describe('getDomainInitial', () => {
  it('returns uppercase first letter', () => {
    const { letter } = getDomainInitial('github.com');
    expect(letter).toBe('G');
  });

  it('returns a gradient tuple', () => {
    const { gradient } = getDomainInitial('github.com');
    expect(gradient).toHaveLength(2);
    expect(gradient[0]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(gradient[1]).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('returns consistent gradient for the same domain', () => {
    const a = getDomainInitial('example.com');
    const b = getDomainInitial('example.com');
    expect(a.gradient).toEqual(b.gradient);
  });
});
