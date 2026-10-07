import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOTS = ['apps/extension/src', 'packages', 'apps/desktop/src', 'apps/desktop/scripts'];
const UNDERSCORE_KEY = /\bi18n\.t\(\s*['"`][A-Za-z][A-Za-z0-9]*_/;

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });

const problems = ROOTS.flatMap(walk).flatMap((file) =>
  readFileSync(file, 'utf8')
    .split('\n')
    .flatMap((line, index) => (UNDERSCORE_KEY.test(line) ? [`${relative('.', file)}:${index + 1}`] : [])),
);

if (problems.length > 0) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} translation key(s) use _ where both surfaces write a dot`);
  process.exit(1);
}
