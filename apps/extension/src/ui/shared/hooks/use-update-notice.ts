import { useEffect, useState } from 'react';
import { dismissUpdateNotice } from '@/lib/update-notice/dismiss-update-notice';
import { readUpdateNotice } from '@/lib/update-notice/read-update-notice';

export function useUpdateNotice(): { version: string | undefined; onDismiss: () => void } {
  const [version, setVersion] = useState<string>();

  useEffect(() => {
    readUpdateNotice().then(setVersion);
  }, []);

  return {
    version,
    onDismiss: () => {
      setVersion(undefined);
      void dismissUpdateNotice();
    },
  };
}
