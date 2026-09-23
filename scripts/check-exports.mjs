import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const ROOTS = ['packages/ui/src', 'src/ui', 'src/lib', 'apps/desktop/src/renderer'];
const SKIP = /\/components\/ui\/|^packages\/ui\/src\/index\.ts$|__tests__|\.test\.tsx?$|\.d\.ts$/;
const WRAPPERS = /^(React\.)?(forwardRef|memo)$/;

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });

const isCallable = (init) =>
  !!init &&
  (ts.isArrowFunction(init) ||
    ts.isFunctionExpression(init) ||
    (ts.isCallExpression(init) && WRAPPERS.test(init.expression.getText())));

const exported = (s) => s.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;

function callables(sf) {
  const out = [];
  for (const s of sf.statements) {
    if ((ts.isFunctionDeclaration(s) && s.body) || ts.isClassDeclaration(s)) {
      out.push({ name: s.name?.text ?? 'default', exported: exported(s) });
    } else if (ts.isVariableStatement(s)) {
      for (const d of s.declarationList.declarations) {
        if (isCallable(d.initializer)) out.push({ name: d.name.getText(sf), exported: exported(s) });
      }
    }
  }
  return out;
}

const problems = [];
for (const file of ROOTS.flatMap(walk).map((f) => relative('.', f))) {
  if (SKIP.test(file)) continue;
  const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const all = callables(sf);
  const pub = all.filter((c) => c.exported);
  const priv = all.filter((c) => !c.exported);
  const component = file.endsWith('.tsx') && pub.some((c) => /^[A-Z]/.test(c.name));
  const reexports = sf.statements.filter((s) => ts.isExportDeclaration(s) && s.moduleSpecifier);
  if (pub.length > 1) problems.push(`${file}: exports ${pub.map((c) => c.name).join(', ')}; one per file`);
  if (component && priv.length)
    problems.push(
      `${file}: component file declares ${priv.map((c) => c.name).join(', ')}; move to lib/ or its own file`,
    );
  if (!component && priv.length > 1)
    problems.push(`${file}: private ${priv.map((c) => c.name).join(', ')}; one helper at most`);
  if (reexports.length) problems.push(`${file}: re-exports; import from the source instead`);
}

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} file(s) break one-export-per-file`);
  process.exit(1);
}
