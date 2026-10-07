import { useCallback, useEffect, useState } from 'react';

const SAVED_BADGE_MS = 1600;

export function useSavedFlash(): { saved: boolean; flash: () => void } {
  const [flashedAt, setFlashedAt] = useState(0);
  const flash = useCallback(() => setFlashedAt(Date.now()), []);

  useEffect(() => {
    if (!flashedAt) return;
    const badge = window.setTimeout(() => setFlashedAt(0), SAVED_BADGE_MS);
    return () => window.clearTimeout(badge);
  }, [flashedAt]);

  return { saved: flashedAt > 0, flash };
}
