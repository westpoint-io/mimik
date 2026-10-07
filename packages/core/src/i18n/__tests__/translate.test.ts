import { describe, expect, it } from 'vitest';
import { translate } from '../translate';

const messages = {
  common: { save: 'Save', updated: 'Updated to v$1', range: '$1 of $2' },
  nested: { deep: { leaf: 'Leaf' } },
};

describe('translate', () => {
  it('resolves a dotted key', () => {
    expect(translate(messages, 'common.save')).toBe('Save');
    expect(translate(messages, 'nested.deep.leaf')).toBe('Leaf');
  });

  it('returns the key when it is missing', () => {
    expect(translate(messages, 'common.missing')).toBe('common.missing');
    expect(translate(messages, 'nope')).toBe('nope');
  });

  it('returns the key when it resolves to a branch', () => {
    expect(translate(messages, 'common')).toBe('common');
  });

  it('does not walk through a string', () => {
    expect(translate(messages, 'common.save.extra')).toBe('common.save.extra');
  });

  it('accepts the underscore key style as well as dots', () => {
    expect(translate(messages, 'common.save')).toBe('Save');
    expect(translate(messages, 'nested_deep_leaf')).toBe('Leaf');
    expect(translate(messages, 'common.updated', ['2.0'])).toBe('Updated to v2.0');
  });

  it('fills substitutions by position', () => {
    expect(translate(messages, 'common.updated', ['2.0'])).toBe('Updated to v2.0');
    expect(translate(messages, 'common.range', ['3', '9'])).toBe('3 of 9');
  });

  it('leaves a placeholder alone when no substitution is given', () => {
    expect(translate(messages, 'common.updated')).toBe('Updated to v$1');
    expect(translate(messages, 'common.range', ['3'])).toBe('3 of $2');
  });
});
