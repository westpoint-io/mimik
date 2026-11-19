import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { desktopEntries } from '../capture/desktop-entries';
import { linuxApp } from '../capture/linux-app';

const data = mkdtempSync(join(tmpdir(), 'mimik-apps-'));
const files = join(data, 'applications', 'org.gnome.Nautilus.desktop');

beforeAll(() => {
  process.env.XDG_DATA_HOME = data;
  mkdirSync(join(data, 'applications'));
  mkdirSync(join(data, 'icons/hicolor/scalable/apps'), { recursive: true });
  writeFileSync(join(data, 'icons/hicolor/scalable/apps/org.gnome.Nautilus.svg'), '<svg/>');
  writeFileSync(
    files,
    '[Desktop Entry]\nName=Files\nExec=nautilus --new-window %U\nIcon=org.gnome.Nautilus\n\n[Desktop Action new-window]\nName=New Window\nExec=other\n',
  );
  writeFileSync(
    join(data, 'applications', 'firefox_firefox.desktop'),
    '[Desktop Entry]\nName=Firefox Web Browser\nExec=env BAMF_DESKTOP_FILE_HINT=/x /snap/bin/firefox %u\nStartupWMClass=firefox\n',
  );
});

const app = (name: string, path: string) => linuxApp({ id: 0, owner: { name, path } });

describe('linuxApp', () => {
  it('names a window after its desktop entry', async () => {
    expect(await app('org.gnome.Nautilus', '/usr/bin/nautilus')).toEqual({ name: 'Files', id: files });
    expect((await app('Firefox', '/snap/firefox/7/usr/lib/firefox/firefox')).name).toBe('Firefox Web Browser');
    expect((await app('SomethingElse', '/usr/bin/nautilus')).name).toBe('Files');
  });

  it('keeps the window class when no entry matches', async () => {
    expect(await app('MysteryTool', '/opt/mystery/bin/tool')).toEqual({
      name: 'MysteryTool',
      id: '/opt/mystery/bin/tool',
    });
  });

  it('resolves the entry icon through the hicolor theme', () => {
    expect(
      desktopEntries()
        .find((entry) => entry.file === files)
        ?.iconFile(),
    ).toBe(join(data, 'icons/hicolor/scalable/apps/org.gnome.Nautilus.svg'));
  });
});
