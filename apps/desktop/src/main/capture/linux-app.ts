import { execFile } from 'node:child_process';
import { basename } from 'node:path';
import { promisify } from 'node:util';
import { type DesktopEntry, desktopEntries } from './desktop-entries';

const run = promisify(execFile);

async function fileManagerFor(windowId: number): Promise<DesktopEntry | undefined> {
  const type = await run('xprop', ['-id', String(windowId), '_NET_WM_WINDOW_TYPE']).catch(() => null);
  if (!type?.stdout.includes('_NET_WM_WINDOW_TYPE_DESKTOP')) return undefined;
  const handler = await run('xdg-mime', ['query', 'default', 'inode/directory']).catch(() => null);
  const file = handler?.stdout.trim();
  return file ? desktopEntries().find((entry) => basename(entry.file) === file) : undefined;
}

export async function linuxApp(window: {
  id: number;
  owner: { name: string; path: string };
}): Promise<{ name: string; id?: string }> {
  const entries = desktopEntries();
  const wmClass = window.owner.name.toLowerCase();
  const command = basename(window.owner.path);
  const entry =
    entries.find((e) => e.wmClass?.toLowerCase() === wmClass) ??
    entries.find((e) => basename(e.file, '.desktop').toLowerCase() === wmClass) ??
    entries.find((e) => e.command === command) ??
    (await fileManagerFor(window.id));
  return entry ? { name: entry.name, id: entry.file } : { name: window.owner.name, id: window.owner.path };
}
