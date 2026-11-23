import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InputHook } from '../capture/input-hook';

const platform = process.platform;
const saved = { session: process.env.XDG_SESSION_TYPE, display: process.env.WAYLAND_DISPLAY };

function restore(key: 'XDG_SESSION_TYPE' | 'WAYLAND_DISPLAY', value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

beforeEach(() => {
  Object.defineProperty(process, 'platform', { value: 'linux' });
});

afterEach(() => {
  Object.defineProperty(process, 'platform', { value: platform });
  restore('XDG_SESSION_TYPE', saved.session);
  restore('WAYLAND_DISPLAY', saved.display);
});

describe('InputHook on Linux', () => {
  it('treats an X11 session with a stale Wayland display as X11', () => {
    process.env.XDG_SESSION_TYPE = 'x11';
    process.env.WAYLAND_DISPLAY = 'wayland-0';

    InputHook.preferX11();

    expect(process.env.WAYLAND_DISPLAY).toBeUndefined();
    expect(InputHook.unsupportedSession()).toBe(false);
  });

  it('keeps a Wayland session as Wayland, which recording refuses', () => {
    process.env.XDG_SESSION_TYPE = 'wayland';
    process.env.WAYLAND_DISPLAY = 'wayland-0';

    InputHook.preferX11();

    expect(process.env.WAYLAND_DISPLAY).toBe('wayland-0');
    expect(InputHook.unsupportedSession()).toBe(true);
  });
});
