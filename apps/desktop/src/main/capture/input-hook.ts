export interface PointerAction {
  kind: 'click';
  button: number;
  x: number;
  y: number;
  clicks: number;
  at: number;
}

export interface KeyAction {
  kind: 'keydown';
  keycode: number;
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
  meta: boolean;
  at: number;
}

export type InputAction = PointerAction | KeyAction;

export type InputHookStart =
  | { ok: true }
  | { ok: false; reason: 'unsupported-session' | 'unavailable'; detail: string };

export class InputHook {
  private hook: typeof import('uiohook-napi').uIOhook | null = null;
  private running = false;

  static unsupportedSession(): boolean {
    return process.platform === 'linux' && process.env.XDG_SESSION_TYPE === 'wayland';
  }

  async start(onAction: (action: InputAction) => void): Promise<InputHookStart> {
    if (this.running) return { ok: true };

    if (InputHook.unsupportedSession()) {
      return {
        ok: false,
        reason: 'unsupported-session',
        detail: 'Global input capture uses X11 XRecord; a Wayland session delivers no events.',
      };
    }

    try {
      const { uIOhook } = await import('uiohook-napi');
      this.hook = uIOhook;

      uIOhook.on('mousedown', (event) => {
        onAction({
          kind: 'click',
          button: Number(event.button ?? 1),
          x: event.x,
          y: event.y,
          clicks: event.clicks ?? 1,
          at: Date.now(),
        });
      });

      uIOhook.on('keydown', (event) => {
        onAction({
          kind: 'keydown',
          keycode: event.keycode,
          shift: event.shiftKey,
          alt: event.altKey,
          ctrl: event.ctrlKey,
          meta: event.metaKey,
          at: Date.now(),
        });
      });

      uIOhook.start();
      this.running = true;
      return { ok: true };
    } catch (error) {
      this.hook = null;
      return { ok: false, reason: 'unavailable', detail: error instanceof Error ? error.message : String(error) };
    }
  }

  stop(): void {
    if (!this.running || !this.hook) return;
    this.hook.removeAllListeners();
    this.hook.stop();
    this.running = false;
    this.hook = null;
  }

  get isRunning(): boolean {
    return this.running;
  }
}
