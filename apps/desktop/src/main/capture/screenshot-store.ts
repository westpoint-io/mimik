import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, net, protocol } from 'electron';

export const SCREENSHOT_SCHEME = 'mimik-screenshot';

function directory(): string {
  const dir = join(app.getPath('userData'), 'screenshots');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function fileFor(id: string): string {
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) throw new Error(`refusing a screenshot id that is not a uuid: ${id}`);
  return join(directory(), `${id}.png`);
}

export function writeScreenshot(id: string, png: Buffer): string {
  writeFileSync(fileFor(id), png);
  return `${SCREENSHOT_SCHEME}://${id}`;
}

export function deleteScreenshot(id: string): void {
  rmSync(fileFor(id), { force: true });
}

export function sweepScreenshots(keep: readonly string[]): number {
  const wanted = new Set(keep);
  let removed = 0;
  for (const entry of readdirSync(directory())) {
    if (!entry.endsWith('.png')) continue;
    if (wanted.has(entry.slice(0, -4))) continue;
    rmSync(join(directory(), entry), { force: true });
    removed++;
  }
  return removed;
}

export function registerScreenshotProtocol(): void {
  protocol.handle(SCREENSHOT_SCHEME, async (request) => {
    const id = new URL(request.url).hostname;
    try {
      const file = fileFor(id);
      if (!existsSync(file)) return new Response(null, { status: 404 });
      return await net.fetch(pathToFileURL(file).toString());
    } catch {
      return new Response(null, { status: 404 });
    }
  });
}
