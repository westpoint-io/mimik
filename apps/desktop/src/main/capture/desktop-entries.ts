import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, isAbsolute, join } from 'node:path';

export interface DesktopEntry {
  file: string;
  name: string;
  wmClass?: string;
  command?: string;
  iconFile(): string | null;
}

const ICON_SIZES = ['256x256', '128x128', '96x96', '64x64', '48x48'];

let cached: DesktopEntry[] | null = null;

export function desktopEntries(): DesktopEntry[] {
  if (cached) return cached;
  const home = homedir();
  const dirs = [
    ...new Set([
      process.env.XDG_DATA_HOME || join(home, '.local/share'),
      ...(process.env.XDG_DATA_DIRS || '/usr/local/share:/usr/share').split(':').filter(Boolean),
      '/var/lib/snapd/desktop',
      '/var/lib/flatpak/exports/share',
      join(home, '.local/share/flatpak/exports/share'),
    ]),
  ];
  const resolveIcon = (icon: string): string | null => {
    if (isAbsolute(icon)) return existsSync(icon) ? icon : null;
    const candidates = dirs.flatMap((dir) => [
      ...ICON_SIZES.map((size) => join(dir, 'icons/hicolor', size, 'apps', `${icon}.png`)),
      join(dir, 'icons/hicolor/scalable/apps', `${icon}.svg`),
      join(dir, 'pixmaps', `${icon}.png`),
      join(dir, 'pixmaps', `${icon}.svg`),
    ]);
    return candidates.find((candidate) => existsSync(candidate)) ?? null;
  };

  cached = dirs.flatMap((dir) => {
    const apps = join(dir, 'applications');
    let names: string[];
    try {
      names = readdirSync(apps).filter((name) => name.endsWith('.desktop'));
    } catch {
      return [];
    }
    return names.flatMap((name): DesktopEntry[] => {
      let text: string;
      try {
        text = readFileSync(join(apps, name), 'utf8').split(/^\[(?!Desktop Entry\])/m)[0] ?? '';
      } catch {
        return [];
      }
      const value = (key: string) => text.match(new RegExp(`^${key}\\s*=\\s*(.+)$`, 'm'))?.[1]?.trim();
      const label = value('Name');
      if (!label) return [];
      const exec = value('Exec')
        ?.replace(/^env(\s+\S+=\S*)*\s+/, '')
        .split(/\s+/)[0]
        ?.replace(/"/g, '');
      const icon = value('Icon');
      return [
        {
          file: join(apps, name),
          name: label,
          wmClass: value('StartupWMClass'),
          command: exec ? basename(exec) : undefined,
          iconFile: () => (icon ? resolveIcon(icon) : null),
        },
      ];
    });
  });
  return cached;
}
