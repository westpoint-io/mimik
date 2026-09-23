import { describe, expect, it } from 'vitest';
import { changedSettings } from '../settings-autosave';

describe('changedSettings', () => {
  it('writes nothing when a render changed no value', () => {
    const snapshot = { targetColor: '#4F46E5', voiceEnabled: true };
    expect(changedSettings({ ...snapshot }, snapshot)).toBeNull();
  });

  it('writes only the field the user touched', () => {
    const previous = { targetColor: '#4F46E5', voiceEnabled: true, aiModel: 'gpt-4o-mini' };
    const next = { ...previous, targetColor: '#059669' };
    expect(changedSettings(next, previous)).toEqual({ targetColor: '#059669' });
  });

  it('never rewrites a value another surface owns', () => {
    const previous = { targetColor: '#4F46E5', voiceEnabled: false };
    const next = { targetColor: '#059669', voiceEnabled: false };
    expect(changedSettings(next, previous)).not.toHaveProperty('voiceEnabled');
  });

  it('compares objects by value, not by identity', () => {
    const previous = { blurPresets: { email: true, ssn: false } };
    const next = { blurPresets: { email: true, ssn: false } };
    expect(changedSettings(next, previous)).toBeNull();
  });

  it('catches a nested toggle inside an object setting', () => {
    const previous = { blurPresets: { email: true, ssn: false } };
    const next = { blurPresets: { email: true, ssn: true } };
    expect(changedSettings(next, previous)).toEqual({ blurPresets: { email: true, ssn: true } });
  });

  it('treats clearing a field as a change worth writing', () => {
    expect(changedSettings({ aiApiKey: '' }, { aiApiKey: 'sk-old' })).toEqual({ aiApiKey: '' });
  });

  it('treats false as a value, not as absent', () => {
    expect(changedSettings({ brandAttribution: false }, { brandAttribution: true })).toEqual({
      brandAttribution: false,
    });
  });

  it('collects several fields changed in one render', () => {
    const previous = { a: 1, b: 2, c: 3 };
    expect(changedSettings({ a: 9, b: 2, c: 8 }, previous)).toEqual({ a: 9, c: 8 });
  });
});
