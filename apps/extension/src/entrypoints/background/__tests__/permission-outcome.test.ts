import { describe, expect, it } from 'vitest';
import { permissionOutcome } from '../voice';

describe('permissionOutcome', () => {
  it('starts narration once access is granted while a recording waits for it', () => {
    expect(permissionOutcome('granted', 'error')).toBe('start');
  });

  it('starts narration when access is granted and nothing has failed yet', () => {
    expect(permissionOutcome('granted', 'idle')).toBe('start');
  });

  it('leaves a running capture alone when access is granted again', () => {
    expect(permissionOutcome('granted', 'recording')).toBe('ignore');
  });

  it('leaves a transcribing take alone when access is granted again', () => {
    expect(permissionOutcome('granted', 'transcribing')).toBe('ignore');
  });

  it('says why narration will not run when access is refused', () => {
    expect(permissionOutcome('denied', 'idle')).toBe('report-denied');
  });

  it('says why even when an earlier attempt already failed', () => {
    expect(permissionOutcome('denied', 'error')).toBe('report-denied');
  });

  it('does not interrupt a running capture when a stale refusal arrives', () => {
    expect(permissionOutcome('denied', 'recording')).toBe('ignore');
  });
});
