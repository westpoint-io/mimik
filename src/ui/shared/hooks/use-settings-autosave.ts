import { localStorage } from '@mimik/core/env';
import { logger } from '@mimik/core/logger';
import { useSavedFlash } from '@mimik/ui';
import { useCallback, useEffect, useRef } from 'react';
import { changedSettings, type SettingsSnapshot } from '@/ui/shared/lib/changed-settings';

const SAVE_DEBOUNCE_MS = 400;

export interface SettingsAutosave {
  saved: boolean;
  queue: (patch: SettingsSnapshot) => void;
}

export function useSettingsAutosave(stored: SettingsSnapshot, ready: boolean): SettingsAutosave {
  const { saved, flash } = useSavedFlash();
  const snapshot = useRef<SettingsSnapshot | null>(null);
  const pending = useRef<SettingsSnapshot>({});
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(async () => {
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length === 0) return;
    try {
      await localStorage.set(patch);
      flash();
    } catch (err) {
      logger.error('Settings autosave failed', err);
    }
  }, [flash]);

  const queue = useCallback(
    (patch: SettingsSnapshot) => {
      Object.assign(pending.current, patch);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
    },
    [flush],
  );

  useEffect(() => {
    if (!ready) return;
    if (!snapshot.current) {
      snapshot.current = stored;
      return;
    }
    const patch = changedSettings(stored, snapshot.current);
    if (!patch) return;
    snapshot.current = stored;
    queue(patch);
  });

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      void flush();
    },
    [flush],
  );

  return { saved, queue };
}
