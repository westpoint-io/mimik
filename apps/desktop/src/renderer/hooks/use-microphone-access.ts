import { useEffect, useState } from 'react';
import type { MicrophoneAccess } from '../../main/permissions';

const POLL_MS = 2000;

export function useMicrophoneAccess() {
  const [access, setAccess] = useState<MicrophoneAccess | null>(null);

  useEffect(() => {
    let alive = true;
    const read = () =>
      window.mimik.microphone.get().then((found) => {
        if (alive) setAccess(found);
      });
    void read();
    const timer = setInterval(read, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const request = () => window.mimik.microphone.request().then(setAccess);

  return { access, request };
}
