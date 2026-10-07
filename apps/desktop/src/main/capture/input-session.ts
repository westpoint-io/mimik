import type { ScreenElement } from './element';

const SNAPSHOT_MS = 400;

export interface ClosedInput {
  field: Promise<ScreenElement | null>;
  fresh: boolean;
  typed: () => Promise<string>;
}

export class InputSession {
  active = false;
  private buffer = '';
  private keys = 0;
  private snapshot: { field: Promise<ScreenElement | null>; keys: number } | null = null;
  private snapshotTimer: NodeJS.Timeout | null = null;
  private idle: NodeJS.Timeout | null = null;
  private appending: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly focused: () => Promise<ScreenElement | null>,
    private readonly onIdle: () => void,
  ) {}

  update(debounceMs: number): void {
    this.active = true;
    this.keys += 1;
    if (this.idle) clearTimeout(this.idle);
    this.idle = setTimeout(this.onIdle, debounceMs);
    this.idle.unref?.();
    if (this.snapshotTimer) clearTimeout(this.snapshotTimer);
    this.snapshotTimer = setTimeout(() => {
      this.snapshot = { field: this.focused().catch(() => null), keys: this.keys };
    }, SNAPSHOT_MS);
    this.snapshotTimer.unref?.();
  }

  append(text: () => string | null | Promise<string | null>): void {
    this.appending = this.appending.then(async () => {
      const typed = await text();
      if (typed) this.buffer += typed;
    });
  }

  backspace(): void {
    this.appending = this.appending.then(() => {
      this.buffer = [...this.buffer].slice(0, -1).join('');
    });
  }

  clear(): void {
    this.appending = this.appending.then(() => {
      this.buffer = '';
    });
  }

  finalize(readNow: boolean): ClosedInput | null {
    if (this.idle) clearTimeout(this.idle);
    if (this.snapshotTimer) clearTimeout(this.snapshotTimer);
    this.idle = null;
    this.snapshotTimer = null;
    const snapshot = readNow ? null : this.snapshot;
    this.snapshot = null;
    if (!this.active) return null;
    this.active = false;
    return {
      field: snapshot ? snapshot.field : this.focused().catch(() => null),
      fresh: !snapshot || snapshot.keys === this.keys,
      typed: async () => {
        await this.appending;
        const typed = this.buffer;
        this.buffer = '';
        return typed;
      },
    };
  }
}
