import { i18n } from '@mimik/core/env';
import { getSnapshots, renameSnapshot, revertToSnapshot } from '@mimik/core/guides/service';
import type { Snapshot } from '@mimik/core/guides/types';
import { useEffect, useRef, useState } from 'react';

function isQuotaError(e: unknown): boolean {
  return e instanceof Error && (e.name === 'QuotaExceededError' || e.name === 'DexieError2QuotaExceededError');
}

export interface Snapshots {
  list: Snapshot[];
  loading: boolean;
  error: string | null;
  restoring: boolean;
  clearError: () => void;
  rename: (snapshot: Snapshot, name: string | undefined) => Promise<void>;
  restore: (snapshot: Snapshot, onRestored: () => void) => Promise<boolean>;
}

export function useSnapshots(guideId: string, refreshKey: number, onReload: () => void): Snapshots {
  const [list, setList] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const seen = useRef(refreshKey);

  useEffect(() => {
    const silent = seen.current !== refreshKey;
    seen.current = refreshKey;
    let cancelled = false;
    if (!silent) {
      setLoading(true);
      setError(null);
      onReload();
    }
    getSnapshots(guideId)
      .then((next) => {
        if (!cancelled) setList(next);
      })
      .catch(() => {
        if (!cancelled) setError(i18n.t('history.loadError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [guideId, refreshKey, onReload]);

  const restore = async (snapshot: Snapshot, onRestored: () => void): Promise<boolean> => {
    if (restoring) return false;
    setRestoring(true);
    setError(null);
    try {
      const undo = await revertToSnapshot(snapshot.id);
      if (!undo) {
        setError(i18n.t('history.restoreError'));
        return false;
      }
      setList(await getSnapshots(guideId));
      onRestored();
      return true;
    } catch (e) {
      setError(i18n.t(isQuotaError(e) ? 'history.storageFull' : 'history.restoreError'));
      return false;
    } finally {
      setRestoring(false);
    }
  };

  const rename = async (snapshot: Snapshot, name: string | undefined) => {
    try {
      await renameSnapshot(snapshot.id, name ?? '');
      setList((prev) => prev.map((s) => (s.id === snapshot.id ? { ...s, name } : s)));
    } catch {
      setError(i18n.t('history.renameError'));
    }
  };

  return { list, loading, error, restoring, clearError: () => setError(null), rename, restore };
}
