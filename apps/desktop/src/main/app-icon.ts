import { isAbsolute } from 'node:path';
import { app, protocol } from 'electron';

export const APP_ICON_SCHEME = 'mimik-app-icon';

export function registerAppIconProtocol(): void {
  protocol.handle(APP_ICON_SCHEME, async (request) => {
    const path = new URL(request.url).searchParams.get('path');
    if (!path || !isAbsolute(path)) return new Response(null, { status: 404 });
    try {
      const icon = await app.getFileIcon(path, { size: 'normal' });
      if (icon.isEmpty()) return new Response(null, { status: 404 });
      return new Response(new Uint8Array(icon.toPNG()), { headers: { 'content-type': 'image/png' } });
    } catch {
      return new Response(null, { status: 404 });
    }
  });
}
