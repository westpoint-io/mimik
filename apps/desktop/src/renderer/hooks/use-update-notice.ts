import { useEffect, useState } from 'react';
import { updatedVersion } from '../lib/updated-version';

export function useUpdateNotice(): { version: string | undefined; onDismiss: () => void } {
  const [version, setVersion] = useState<string>();

  useEffect(() => {
    void window.mimik.version().then((running) => setVersion(updatedVersion(window.localStorage, running)));
  }, []);

  return {
    version,
    onDismiss: () => {
      setVersion(undefined);
      window.localStorage.removeItem('mimik.updateNotice');
    },
  };
}
