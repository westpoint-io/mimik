import './core-env';
import { migration } from './check-storage/migration';
import { open } from './check-storage/open';
import { read } from './check-storage/read';
import { report } from './check-storage/report';
import type { CheckResult } from './check-storage/types';
import { write } from './check-storage/write';

async function run(): Promise<CheckResult[]> {
  const [role, guideId] = (window.location.hash.slice(1) || 'write:unknown').split(':');
  if (role === 'read') return [await read(guideId!)];
  return [await migration(), await open(), await write(guideId!)];
}

run()
  .then(report)
  .catch((error) =>
    report([{ name: 'storage check', ok: false, detail: error instanceof Error ? error.message : String(error) }]),
  );
