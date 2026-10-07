import { db } from '@mimik/core/guides/db';
import type { CheckResult } from './types';

export async function open(): Promise<CheckResult> {
  await db.open();
  const tables = db.tables.map((t) => t.name).sort();
  const expected = ['guideMerges', 'guides', 'screenshots', 'snapshots', 'steps', 'transcripts', 'voiceClips'];
  return {
    name: 'MimikDB opens',
    ok: db.verno === 5 && expected.every((t) => tables.includes(t)),
    detail: `v${db.verno}, tables: ${tables.join(', ')}`,
  };
}
