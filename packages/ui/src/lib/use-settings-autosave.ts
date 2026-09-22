import { localStorage } from '@mimik/core/env';
import { logger } from '@mimik/ui/lib/logger';
import { changedSettings, type SettingsSnapshot } from '@mimik/ui/lib/settings-autosave';
import { useCallback, useEffect, useRef, useState } from 'react';

const SAVE_DEBOUNCE_MS = 400;
const SAVED_BADGE_MS = 1600;

export interface SettingsAutosave {
  saved: boolean;
  queue: (patch: SettingsSnapshot) => void;
}

export function useSettingsAutosave(stored: SettingsSnapshot, ready: boolean): SettingsAutosave {
  const [saved, setSaved] = useState(false);
  const snapshot = useRef<SettingsSnapshot | null>(null);
  const pending = useRef<SettingsSnapshot>({});
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(async () => {
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length === 0) return;
    try {
      await localStorage.set(patch);
      setSaved(true);
    } catch (err) {
      logger.error('Settings autosave failed', err);
      setSaved(false);
    }
  }, []);

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

  useEffect(() => {
    if (!saved) return;
    const badge = window.setTimeout(() => setSaved(false), SAVED_BADGE_MS);
    return () => window.clearTimeout(badge);
  }, [saved]);

  return { saved, queue };
}
