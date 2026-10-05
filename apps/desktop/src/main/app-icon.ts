import { isAbsolute } from 'node:path';
import { app, type NativeImage, nativeImage, protocol } from 'electron';

export const APP_ICON_SCHEME = 'mimik-app-icon';
const ICON_PX = 64;

async function iconFor(path: string): Promise<NativeImage> {
  if (process.platform === 'darwin') {
    const thumbnail = await nativeImage
      .createThumbnailFromPath(path, { width: ICON_PX, height: ICON_PX })
      .catch(() => null);
    if (thumbnail && !thumbnail.isEmpty()) return thumbnail;
  }
  return app.getFileIcon(path, { size: 'normal' });
}

export function registerAppIconProtocol(): void {
  protocol.handle(APP_ICON_SCHEME, async (request) => {
    const path = new URL(request.url).searchParams.get('path');
    if (!path || !isAbsolute(path)) return new Response(null, { status: 404 });
    try {
      const icon = await iconFor(path);
      if (icon.isEmpty()) return new Response(null, { status: 404 });
      return new Response(new Uint8Array(icon.toPNG()), { headers: { 'content-type': 'image/png' } });
    } catch {
      return new Response(null, { status: 404 });
    }
  });
}
