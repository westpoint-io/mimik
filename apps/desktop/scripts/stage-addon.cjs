const { cpSync, existsSync, mkdirSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { Arch } = require('electron-builder');

const SOURCE = join(__dirname, '..', '..', '..', 'packages', 'capture-native');
const TARGET = join(__dirname, '..', 'staging', 'addon');
const FILES = ['package.json', 'index.js', 'index.d.ts'];
const BINARIES = {
  'linux-x64': 'capture-native.linux-x64-gnu.node',
  'win32-x64': 'capture-native.win32-x64-msvc.node',
  'darwin-x64': 'capture-native.darwin-x64.node',
  'darwin-arm64': 'capture-native.darwin-arm64.node',
};

exports.default = async ({ electronPlatformName, arch }) => {
  const target = `${electronPlatformName}-${Arch[arch]}`;
  const binary = BINARIES[target];
  if (!binary) throw new Error(`No capture addon is mapped for ${target}.`);
  if (!existsSync(join(SOURCE, binary))) {
    throw new Error(`${binary} is missing. Build the capture addon for ${target} before packaging.`);
  }
  rmSync(TARGET, { recursive: true, force: true });
  mkdirSync(TARGET, { recursive: true });
  for (const name of [...FILES, binary]) {
    cpSync(join(SOURCE, name), join(TARGET, name));
  }
};
