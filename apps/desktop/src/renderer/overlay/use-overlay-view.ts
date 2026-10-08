import { useEffect, useState } from 'react';
import type { OverlayView } from '../../main/overlay';

export function useOverlayView(): OverlayView | null {
  const [view, setView] = useState<OverlayView | null>(null);

  useEffect(() => {
    let updated = false;
    window.mimikOverlay.onUpdate((next) => {
      updated = true;
      setView(next);
    });
    void window.mimikOverlay.view().then((first) => {
      if (!updated) setView(first);
    });
  }, []);

  return view;
}
