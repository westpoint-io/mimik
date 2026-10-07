import type { Snapshot } from './types';

export type SnapshotRow = { kind: 'entry'; snapshot: Snapshot } | { kind: 'group'; snapshots: Snapshot[] };

export function groupSnapshots(snapshots: Snapshot[]): SnapshotRow[] {
  const rows: SnapshotRow[] = [];
  let run: Snapshot[] = [];

  const flush = () => {
    if (run.length === 0) return;
    rows.push(run.length === 1 ? { kind: 'entry', snapshot: run[0]! } : { kind: 'group', snapshots: run });
    run = [];
  };

  for (const snapshot of snapshots) {
    if (snapshot.name) {
      flush();
      rows.push({ kind: 'entry', snapshot });
      continue;
    }
    if (run.length > 0 && run[0]!.contentHash !== snapshot.contentHash) flush();
    run.push(snapshot);
  }
  flush();

  return rows;
}
