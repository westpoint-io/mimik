import { describe, expect, it } from 'vitest';
import { getMostCommonApp } from '../most-common-app';

const chrome = { name: 'Google Chrome', id: '/Applications/Google Chrome.app' };
const terminal = { name: 'Terminal', id: '/System/Applications/Utilities/Terminal.app' };

describe('getMostCommonApp', () => {
  it('picks the app with the most steps, not the first', () => {
    const steps = [{ app: terminal }, { app: terminal }, ...Array.from({ length: 6 }, () => ({ app: chrome }))];
    expect(getMostCommonApp(steps)).toEqual(chrome);
  });

  it('breaks a tie in favour of the app seen first, and skips steps with no app', () => {
    expect(getMostCommonApp([{}, { app: terminal }, { app: chrome }])).toEqual(terminal);
    expect(getMostCommonApp([{}])).toBeNull();
  });
});
