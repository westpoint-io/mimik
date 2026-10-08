import { shortcutLabel } from '@mimik/core/capture/shortcut-label';
import { useEffect, useState } from 'react';

const DEFAULT_RECORD = 'Alt+Shift+R';

export function useRecordShortcut(mac: boolean): string {
  const [accelerator, setAccelerator] = useState(DEFAULT_RECORD);

  useEffect(() => {
    void window.mimik.capture.settings
      .get()
      .then((settings) => setAccelerator(settings.shortcuts.record || DEFAULT_RECORD));
  }, []);

  return shortcutLabel(accelerator, mac);
}
