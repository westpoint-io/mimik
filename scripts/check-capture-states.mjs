import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const MACHINE = 'packages/core/src/capture/machine.ts';
const STATE = /['"`](IDLE|ARMED|RECORDING|PAUSED)['"`]/;
const SKIP = /__tests__|\.test\.tsx?$/;

const files = execFileSync('git', ['ls-files', '*.ts', '*.tsx'], { encoding: 'utf8' })
  .split('\n')
  .filter((file) => file && file !== MACHINE && !SKIP.test(file));

const problems = files.flatMap((file) =>
  readFileSync(file, 'utf8')
    .split('\n')
    .flatMap((line, index) => (STATE.test(line) ? [`${file}:${index + 1}`] : [])),
);

if (problems.length > 0) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} capture state(s) spelled out; use CaptureState from core's machine`);
  process.exit(1);
}
