import Dexie, { type EntityTable } from 'dexie';
import type { Guide, Snapshot, Step, StoredScreenshot } from './types';

export class MimikDB extends Dexie {
  guides!: EntityTable<Guide, 'id'>;
  steps!: EntityTable<Step, 'id'>;
  screenshots!: EntityTable<StoredScreenshot, 'id'>;
  snapshots!: EntityTable<Snapshot, 'id'>;

  constructor(name = 'mimik') {
    super(name);
    this.version(1).stores({
      guides: 'id, createdAt, updatedAt, starred, deletedAt',
      steps: 'id, guideId, index',
      screenshots: 'id, stepId',
    });
    this.version(2).stores({
      snapshots: 'id, guideId, createdAt, [guideId+createdAt]',
    });
  }
}

export const db = new MimikDB();
