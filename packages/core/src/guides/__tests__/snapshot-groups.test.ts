import { describe, expect, it } from 'vitest';
import { groupSnapshots } from '../snapshot-groups';
import type { Snapshot } from '../types';

function snap(id: string, contentHash: string, name?: string): Snapshot {
  return {
    id,
    guideId: 'g1',
    createdAt: 0,
    contentHash,
    title: '',
    stepIds: [],
    steps: [],
    screenshots: [],
    ...(name === undefined ? {} : { name }),
  };
}

describe('groupSnapshots', () => {
  it('returns a plain entry for a lone hash', () => {
    expect(groupSnapshots([snap('a', 'h1')])).toEqual([{ kind: 'entry', snapshot: snap('a', 'h1') }]);
  });

  it('collapses a run of matching hashes into one group', () => {
    const rows = groupSnapshots([snap('a', 'h1'), snap('b', 'h1'), snap('c', 'h1')]);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.kind).toBe('group');
    expect(rows[0]!.kind === 'group' && rows[0]!.snapshots).toHaveLength(3);
  });

  it('keeps runs separate and preserves order', () => {
    const rows = groupSnapshots([snap('a', 'h1'), snap('b', 'h2'), snap('c', 'h2'), snap('d', 'h3')]);

    expect(rows.map((r) => r.kind)).toEqual(['entry', 'group', 'entry']);
  });

  it('preserves snapshot identity and order across rows', () => {
    const rows = groupSnapshots([snap('a', 'h1'), snap('b', 'h2'), snap('c', 'h2'), snap('d', 'h3')]);

    expect(rows[0]!.kind === 'entry' && rows[0]!.snapshot.id).toBe('a');
    expect(rows[1]!.kind === 'group' && rows[1]!.snapshots.map((s) => s.id)).toEqual(['b', 'c']);
    expect(rows[2]!.kind === 'entry' && rows[2]!.snapshot.id).toBe('d');
  });

  it('does not merge non-adjacent matching hashes', () => {
    const rows = groupSnapshots([snap('a', 'h1'), snap('b', 'h2'), snap('c', 'h1')]);

    expect(rows.map((r) => r.kind)).toEqual(['entry', 'entry', 'entry']);
  });

  it('returns nothing for an empty list', () => {
    expect(groupSnapshots([])).toEqual([]);
  });

  it('keeps a named snapshot out of a run of three, splitting it into three entries', () => {
    const rows = groupSnapshots([snap('a', 'h1'), snap('b', 'h1', 'before rewrite'), snap('c', 'h1')]);

    expect(rows.map((r) => r.kind)).toEqual(['entry', 'entry', 'entry']);
    expect(rows.map((r) => r.kind === 'entry' && r.snapshot.id)).toEqual(['a', 'b', 'c']);
  });

  it('splits a longer run around a named snapshot', () => {
    const rows = groupSnapshots([
      snap('a', 'h1'),
      snap('b', 'h1'),
      snap('c', 'h1', 'checkpoint'),
      snap('d', 'h1'),
      snap('e', 'h1'),
    ]);

    expect(rows.map((r) => r.kind)).toEqual(['group', 'entry', 'group']);
    expect(rows[0]!.kind === 'group' && rows[0]!.snapshots.map((s) => s.id)).toEqual(['a', 'b']);
    expect(rows[1]!.kind === 'entry' && rows[1]!.snapshot.id).toBe('c');
    expect(rows[2]!.kind === 'group' && rows[2]!.snapshots.map((s) => s.id)).toEqual(['d', 'e']);
  });

  it('never hides a named snapshot inside a group', () => {
    const rows = groupSnapshots([
      snap('a', 'h1'),
      snap('b', 'h1', 'first name'),
      snap('c', 'h1'),
      snap('d', 'h1'),
      snap('e', 'h2'),
      snap('f', 'h2', 'second name'),
    ]);

    const grouped = rows.flatMap((r) => (r.kind === 'group' ? r.snapshots : []));
    expect(grouped.some((s) => s.name)).toBe(false);
    expect(rows.filter((r) => r.kind === 'entry' && r.snapshot.name).length).toBe(2);
  });

  it('keeps a named snapshot at the head of the list as an entry', () => {
    const rows = groupSnapshots([snap('a', 'h1', 'named head'), snap('b', 'h1'), snap('c', 'h1')]);

    expect(rows.map((r) => r.kind)).toEqual(['entry', 'group']);
    expect(rows[0]!.kind === 'entry' && rows[0]!.snapshot.id).toBe('a');
  });

  it('keeps a named snapshot at the tail of the list as an entry', () => {
    const rows = groupSnapshots([snap('a', 'h1'), snap('b', 'h1'), snap('c', 'h1', 'named tail')]);

    expect(rows.map((r) => r.kind)).toEqual(['group', 'entry']);
    expect(rows[1]!.kind === 'entry' && rows[1]!.snapshot.id).toBe('c');
  });

  it('treats an empty name as unnamed', () => {
    const rows = groupSnapshots([snap('a', 'h1'), snap('b', 'h1', ''), snap('c', 'h1')]);

    expect(rows.map((r) => r.kind)).toEqual(['group']);
    expect(rows[0]!.kind === 'group' && rows[0]!.snapshots).toHaveLength(3);
  });
});
