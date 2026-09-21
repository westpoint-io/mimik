import type { UiElement } from '@mimik/capture-native';
import { screen } from 'electron';
import { toDip } from './focused-window';

const LOOKUP_TIMEOUT_MS = 1500;

export interface ScreenElement {
  role: string | null;
  name: string | null;
  textContent: string | null;
  ariaLabel: string | null;
  altText: string | null;
  rect: { x: number; y: number; width: number; height: number } | null;
}

type Addon = {
  elementAtPoint(x: number, y: number): Promise<UiElement | null>;
  isSupported(): boolean;
};

let addon: Addon | null | undefined;

async function load(): Promise<Addon | null> {
  if (addon === undefined) {
    try {
      addon = (await import('@mimik/capture-native')) as unknown as Addon;
    } catch {
      addon = null;
    }
  }
  return addon;
}

function within<T>(work: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    timer.unref?.();
    const settle = (value: T | null) => {
      clearTimeout(timer);
      resolve(value);
    };
    work.then(settle, () => settle(null));
  });
}

function toPhysical(point: { x: number; y: number }): { x: number; y: number } {
  if (process.platform !== 'win32' || typeof screen.dipToScreenPoint !== 'function') return point;
  try {
    return screen.dipToScreenPoint(point);
  } catch {
    return point;
  }
}

export async function elementAt(point: { x: number; y: number }): Promise<ScreenElement | null> {
  const native = await load();
  if (!native) return null;

  const at = toPhysical(point);
  const found = await within(native.elementAtPoint(Math.round(at.x), Math.round(at.y)), LOOKUP_TIMEOUT_MS);
  if (!found) return null;

  return {
    role: found.role ?? null,
    name: found.automationId ?? null,
    textContent: found.value ?? null,
    ariaLabel: found.name ?? null,
    altText: found.helpText ?? null,
    rect: toDip(found.rect ?? null),
  };
}

export async function elementLookupAvailable(): Promise<boolean> {
  const native = await load();
  return native?.isSupported() ?? false;
}
