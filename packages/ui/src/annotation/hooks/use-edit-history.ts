import type { Annotation } from '@mimik/core/screenshot/types';
import { type RefObject, useCallback, useState } from 'react';

const HISTORY_LIMIT = 50;

export interface EditHistory {
  canUndo: boolean;
  canRedo: boolean;
  push: () => void;
  undo: () => Annotation[] | null;
  redo: () => Annotation[] | null;
}

export function useEditHistory(current: RefObject<Annotation[]>): EditHistory {
  const [past, setPast] = useState<Annotation[][]>([]);
  const [future, setFuture] = useState<Annotation[][]>([]);

  const push = useCallback(() => {
    setPast((p) => [...p.slice(-HISTORY_LIMIT), current.current]);
    setFuture([]);
  }, [current]);

  const undo = (): Annotation[] | null => {
    if (!past.length) return null;
    setFuture((f) => [current.current, ...f]);
    setPast((p) => p.slice(0, -1));
    return past[past.length - 1];
  };

  const redo = (): Annotation[] | null => {
    if (!future.length) return null;
    setPast((p) => [...p, current.current]);
    setFuture((f) => f.slice(1));
    return future[0];
  };

  return { canUndo: past.length > 0, canRedo: future.length > 0, push, undo, redo };
}
