import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { Plugin } from 'vite';

interface Notice {
  name: string;
  version: string;
  license: string;
  url?: string;
  texts: string[];
}

interface Crate {
  id: string;
  name: string;
  version: string;
  license: string | null;
  repository: string | null;
  manifest_path: string;
  targets: { kind: string[] }[];
}

interface CrateNode {
  id: string;
  deps: { pkg: string; dep_kinds: { kind: string | null }[] }[];
}

const APP = resolve(__dirname, '..');
const ADDON = resolve(APP, '../../packages/capture-native');
const ADDON_TARGETS: Record<string, string> = {
  'capture-native.win32-x64-msvc.node': 'x86_64-pc-windows-msvc',
  'capture-native.darwin-arm64.node': 'aarch64-apple-darwin',
  'capture-native.darwin-x64.node': 'x86_64-apple-darwin',
};
const OUT = join(APP, 'out/THIRD_PARTY_NOTICES.txt');
const LICENCE_FILE = /^(licen[cs]e|copying|notice|copyright)([.\-_].*)?$/i;
const PACKAGE_DIR = /^(.*[\\/]node_modules[\\/](?:@[^\\/]+[\\/])?[^\\/]+)[\\/]/;
const RULE = '-'.repeat(79);

const read = (path: string) => readFileSync(path, 'utf8').trim();
const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

const licenceTexts = (dir: string) =>
  readdirSync(dir)
    .filter((file) => LICENCE_FILE.test(file))
    .sort()
    .map((file) => read(join(dir, file)));

const HAND_ADDED: Notice[] = [
  {
    name: 'libuiohook',
    version: 'as built into uiohook-napi',
    license: 'LGPL-3.0-or-later',
    url: 'https://github.com/SnosMe/uiohook-napi/tree/master/libuiohook',
    texts: [
      "Copyright (C) 2006-2023 Alexander Barker.\n\nCompiled into uiohook-napi's prebuilt uiohook-napi.node, which Mimik loads as a separate file and\nwhich can be replaced by one built from the source above.",
      read(join(APP, 'licenses/LGPL-3.0.txt')),
    ],
  },
  {
    name: 'LobeHub Icons',
    version: 'provider logos',
    license: 'MIT',
    url: 'https://github.com/lobehub/lobe-icons',
    texts: [read(join(APP, 'licenses/lobehub-icons.txt'))],
  },
];

function repositoryUrl(repository: unknown): string | undefined {
  const raw = typeof repository === 'string' ? repository : (repository as { url?: string } | undefined)?.url;
  if (!raw) return undefined;
  const url = raw
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/^github:/, '')
    .replace(/\.git$/, '');
  return /^[\w.-]+\/[\w.-]+$/.test(url) ? `https://github.com/${url}` : url;
}

function npmNotice(dir: string): Notice {
  const pkg = readJson(join(dir, 'package.json'));
  const license =
    typeof pkg.license === 'string'
      ? pkg.license
      : (pkg.license?.type ?? pkg.licenses?.map((entry: { type: string }) => entry.type).join(' OR ') ?? 'UNKNOWN');
  return { name: pkg.name, version: pkg.version, license, url: repositoryUrl(pkg.repository), texts: licenceTexts(dir) };
}

function findPackage(name: string, from: string): string | null {
  for (let dir = from; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return realpathSync(candidate);
    if (dirname(dir) === dir) return null;
  }
}

function shippedPackages(): string[] {
  const seen = new Set<string>();
  const visit = (name: string, from: string) => {
    const dir = findPackage(name, from);
    if (!dir || seen.has(dir)) return;
    seen.add(dir);
    const pkg = readJson(join(dir, 'package.json'));
    for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies })) visit(dep, dir);
  };
  for (const dep of Object.keys(readJson(join(APP, 'package.json')).dependencies)) {
    if (!dep.startsWith('@mimik/')) visit(dep, APP);
  }
  return [...seen];
}

function crateNotices(): Notice[] {
  const target = Object.entries(ADDON_TARGETS).find(([binary]) => existsSync(join(ADDON, binary)))?.[1];
  if (!target) return [];
  const args = ['metadata', '--format-version', '1', '--offline', '--filter-platform', target];
  const meta: { packages: Crate[]; resolve: { root: string; nodes: CrateNode[] } } = JSON.parse(
    execFileSync('cargo', [...args, '--manifest-path', join(ADDON, 'Cargo.toml')], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    }),
  );
  const packages = new Map(meta.packages.map((pkg) => [pkg.id, pkg]));
  const nodes = new Map(meta.resolve.nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();
  const visit = (id: string) => {
    for (const dep of nodes.get(id)?.deps ?? []) {
      const pkg = packages.get(dep.pkg);
      if (!pkg) continue;
      const runtime = dep.dep_kinds.some((kind) => kind.kind === null);
      const macro = pkg.targets.some((target) => target.kind.includes('proc-macro'));
      if (seen.has(dep.pkg) || !runtime || macro) continue;
      seen.add(dep.pkg);
      visit(dep.pkg);
    }
  };
  visit(meta.resolve.root);
  return [...seen].map((id) => {
    const pkg = packages.get(id) as Crate;
    return {
      name: pkg.name,
      version: pkg.version,
      license: pkg.license ?? 'UNKNOWN',
      url: pkg.repository ?? undefined,
      texts: licenceTexts(dirname(pkg.manifest_path)),
    };
  });
}

function render(notices: Notice[]): string {
  const byKey = new Map(notices.map((notice) => [`${notice.name}@${notice.version}`, notice]));
  const sorted = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
  const header = [
    'Mimik third-party notices',
    '',
    'Mimik is released under the MIT License, in LICENSE.txt beside this file. It includes the',
    'open-source software listed below, each under its own licence, reproduced as that software',
    "ships it. Electron's and Chromium's notices are in LICENSE.electron.txt and LICENSES.chromium.html,",
    'also beside this file.',
  ].join('\n');
  const entries = sorted.map((notice) => {
    const title = [`${notice.name} ${notice.version}`, notice.license, notice.url].filter(Boolean).join('\n');
    const body = notice.texts.length
      ? notice.texts.join('\n\n')
      : `This package ships no licence file. Its declared licence is ${notice.license}.`;
    return `${RULE}\n${title}\n\n${body}`;
  });
  return `${header}\n\n${entries.join('\n\n')}\n`;
}

export function thirdPartyNotices(): Plugin {
  const bundled = new Set<string>();
  return {
    name: 'mimik-third-party-notices',
    apply: 'build',
    generateBundle() {
      for (const id of this.getModuleIds()) {
        const dir = PACKAGE_DIR.exec(id.replace(/^\0/, '').split('?')[0])?.[1];
        if (dir && existsSync(join(dir, 'package.json'))) bundled.add(realpathSync(dir));
      }
    },
    closeBundle() {
      const dirs = new Set([...bundled, ...shippedPackages()]);
      writeFileSync(OUT, render([...[...dirs].map(npmNotice), ...crateNotices(), ...HAND_ADDED]));
    },
  };
}
