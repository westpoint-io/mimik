import { MimikDB } from '@mimik/core/guides/db';
import Dexie from 'dexie';
import type { CheckResult } from './types';

const MIGRATION_DB = 'mimik-migration-check';

export async function migration(): Promise<CheckResult> {
  await Dexie.delete(MIGRATION_DB);

  const v1 = new Dexie(MIGRATION_DB);
  v1.version(1).stores({
    guides: 'id, createdAt, updatedAt, starred, deletedAt',
    steps: 'id, guideId, index',
    screenshots: 'id, stepId',
  });
  await v1.open();
  await v1.table('guides').add({ id: 'legacy', title: 'Written at v1', createdAt: 1, updatedAt: 1, stepIds: [] });
  v1.close();

  const upgraded = new MimikDB(MIGRATION_DB);
  await upgraded.open();
  const survivor = await upgraded.guides.get('legacy');
  const snapshotCount = await upgraded.snapshots.count();
  const verno = upgraded.verno;
  upgraded.close();
  await Dexie.delete(MIGRATION_DB);

  return {
    name: 'v1 to current migration',
    ok: verno === 5 && survivor?.title === 'Written at v1' && snapshotCount === 0,
    detail: `reopened at v${verno}, v1 row ${survivor ? 'survived' : 'lost'}, snapshots table readable`,
  };
}
