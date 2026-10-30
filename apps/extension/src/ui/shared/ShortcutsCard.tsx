import { i18n } from '@mimik/core/env';
import { Button, SettingsCard } from '@mimik/ui';
import { Command, ExternalLink } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { browser } from '#imports';
import { createTab } from '@/lib/browser-api/create-tab';
import { ShortcutKey } from '@/ui/shared/ShortcutKey';

const COMMANDS = [
  { name: 'toggle-recording', labelKey: 'desktop.shortcutRecord', hintKey: 'settings.shortcutRecordHint' },
  { name: 'toggle-pause', labelKey: 'desktop.shortcutPause', hintKey: 'settings.shortcutPauseHint' },
  { name: 'capture-now', labelKey: 'desktop.shortcutCapture', hintKey: 'settings.shortcutCaptureHint' },
];
const EDITABLE = import.meta.env.BROWSER === 'firefox';

export function ShortcutsCard() {
  const [shortcuts, setShortcuts] = useState<Record<string, string>>({});

  const refresh = useCallback(() => {
    browser.commands
      .getAll()
      .then((all) => setShortcuts(Object.fromEntries(all.map((command) => [command.name, command.shortcut ?? '']))))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refresh]);

  return (
    <SettingsCard icon={Command} title={i18n.t('desktop.shortcutsSection')} hint={i18n.t('settings.shortcutsHint')}>
      <div>
        {COMMANDS.map(({ name, labelKey, hintKey }) => (
          <ShortcutKey
            key={name}
            name={name}
            label={i18n.t(labelKey)}
            hint={i18n.t(hintKey)}
            shortcut={shortcuts[name] ?? ''}
            editable={EDITABLE}
            onChanged={refresh}
          />
        ))}
      </div>
      {!EDITABLE && (
        <div className="flex items-center justify-between gap-3 border-t border-secondary pt-3">
          <p className="text-[11px] text-muted-foreground">{i18n.t('settings.shortcutsChangeNote')}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 gap-1.5 px-2.5 text-[11px]"
            onClick={() => void createTab({ url: 'chrome://extensions/shortcuts' })}
          >
            <ExternalLink size={12} />
            {i18n.t('settings.shortcutsChange')}
          </Button>
        </div>
      )}
    </SettingsCard>
  );
}
