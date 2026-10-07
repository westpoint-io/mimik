import Dexie, { type EntityTable } from 'dexie';
import type { Guide, GuideMerge, GuideTranscript, Snapshot, Step, StoredScreenshot, VoiceClip } from './types';

export class MimikDB extends Dexie {
  guides!: EntityTable<Guide, 'id'>;
  steps!: EntityTable<Step, 'id'>;
  screenshots!: EntityTable<StoredScreenshot, 'id'>;
  snapshots!: EntityTable<Snapshot, 'id'>;
  voiceClips!: EntityTable<VoiceClip, 'id'>;
  transcripts!: EntityTable<GuideTranscript, 'id'>;
  guideMerges!: EntityTable<GuideMerge, 'id'>;

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
    this.version(3).stores({
      voiceClips: 'id, createdAt',
    });
    this.version(4).stores({
      transcripts: 'id, guideId, [guideId+epochMs]',
    });
    this.version(5).stores({
      guideMerges: 'id, targetGuideId, mergedAt',
    });
  }
}

export const db = new MimikDB();
