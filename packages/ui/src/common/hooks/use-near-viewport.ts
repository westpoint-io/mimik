import { type RefObject, useEffect, useState } from 'react';

const AHEAD = '1000px 0px';

export function useNearViewport(ref: RefObject<Element | null>): boolean {
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const element = ref.current;
    if (near || !element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { rootMargin: AHEAD },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, near]);

  return near;
}
