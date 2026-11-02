import { useEffect, useState } from 'react';
import type { UpdateStatus } from '../../main/ipc';

export function useUpdateStatus() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);

  useEffect(() => {
    let alive = true;
    window.mimik.updates.status().then((found) => {
      if (alive && found) setStatus(found);
    });
    const stop = window.mimik.updates.onStatus(setStatus);
    return () => {
      alive = false;
      stop();
    };
  }, []);

  return status;
}
