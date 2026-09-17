import { screen } from 'electron';

export interface FocusedWindow {
  title: string | null;
  app: { name: string; id?: string };
  bounds: { x: number; y: number; width: number; height: number } | null;
}

export type FocusedWindowResult =
  | { ok: true; window: FocusedWindow }
  | { ok: false; reason: 'unsupported-session' | 'missing-tooling' | 'permission' | 'unknown'; detail: string };

function classify(message: string): Exclude<FocusedWindowResult, { ok: true }>['reason'] {
  if (/xwininfo|xprop|ENOENT/i.test(message)) return 'missing-tooling';
  if (/permission|not authorized|denied/i.test(message)) return 'permission';
  if (process.platform === 'linux' && process.env.XDG_SESSION_TYPE === 'wayland') return 'unsupported-session';
  return 'unknown';
}

function toDip(bounds: FocusedWindow['bounds']): FocusedWindow['bounds'] {
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null;
  if (process.platform !== 'win32' || typeof screen.screenToDipRect !== 'function') return bounds;
  try {
    return screen.screenToDipRect(null, bounds);
  } catch {
    return bounds;
  }
}

export async function focusedWindow(): Promise<FocusedWindowResult> {
  if (process.platform === 'linux' && process.env.XDG_SESSION_TYPE === 'wayland') {
    return {
      ok: false,
      reason: 'unsupported-session',
      detail: 'Active-window lookup needs an X11 session; Wayland is not supported yet.',
    };
  }

  try {
    const { activeWindow } = await import('get-windows');
    const found = await activeWindow();
    if (!found) return { ok: false, reason: 'unknown', detail: 'no active window reported' };
    return {
      ok: true,
      window: {
        title: found.title || null,
        app: { name: found.owner.name, id: 'bundleId' in found.owner ? found.owner.bundleId : found.owner.path },
        bounds: toDip(found.bounds ?? null),
      },
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: classify(detail), detail };
  }
}
