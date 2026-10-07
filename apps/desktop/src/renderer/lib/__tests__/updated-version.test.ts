import { beforeEach, describe, expect, it } from 'vitest';
import { updatedVersion } from '../updated-version';

describe('updatedVersion', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stays quiet on the first launch', () => {
    expect(updatedVersion(localStorage, '1.1.1')).toBeUndefined();
  });

  it('announces the new version after an update, and keeps it until dismissed', () => {
    updatedVersion(localStorage, '1.1.1');
    expect(updatedVersion(localStorage, '1.2.0')).toBe('1.2.0');
    expect(updatedVersion(localStorage, '1.2.0')).toBe('1.2.0');

    localStorage.removeItem('mimik.updateNotice');
    expect(updatedVersion(localStorage, '1.2.0')).toBeUndefined();
  });

  it('stays quiet when the same version starts again', () => {
    updatedVersion(localStorage, '1.1.1');
    expect(updatedVersion(localStorage, '1.1.1')).toBeUndefined();
  });
});
