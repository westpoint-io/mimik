import { shortcutLabel } from '@mimik/core/capture/shortcut-label';
import { i18n } from '@mimik/core/env';
import { Button } from '@mimik/ui';
import { X } from 'lucide-react';
import { useState } from 'react';
import { updateCommand } from '@/lib/browser-api/update-command';
import { commandShortcut } from '@/lib/command-shortcut';

const MAC = navigator.userAgent.includes('Mac');

interface ShortcutKeyProps {
  name: string;
  label: string;
  hint: string;
  shortcut: string;
  editable: boolean;
  onChanged: () => void;
}

export function ShortcutKey({ name, label, hint, shortcut, editable, onChanged }: ShortcutKeyProps) {
  const [listening, setListening] = useState(false);

  const save = async (next: string) => {
    try {
      await updateCommand(name, next);
    } catch {
      return;
    }
    setListening(false);
    onChanged();
  };

  const value = shortcut ? (
    <span className="rounded-md border border-lavender bg-card px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-foreground">
      {shortcutLabel(shortcut, MAC)}
    </span>
  ) : (
    <span className="rounded-full bg-badge-edited px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap text-badge-edited-foreground">
      {i18n.t('settings.shortcutNotSet')}
    </span>
  );

  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-secondary last:border-b-0">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
      {editable ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onKeyDown={(event) => {
              if (!listening) return;
              event.preventDefault();
              const next = commandShortcut(event.nativeEvent, MAC);
              if (next) void save(next);
            }}
            onClick={() => setListening(true)}
            onBlur={() => setListening(false)}
            className={`rounded-lg p-0.5 transition-colors ${listening ? 'ring-2 ring-accent/25' : 'hover:bg-secondary'}`}
          >
            {listening ? (
              <span className="px-2 text-[11px] font-semibold text-accent">{i18n.t('desktop.shortcutPress')}</span>
            ) : (
              value
            )}
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={i18n.t('desktop.shortcutClear')}
            onClick={() => void save('')}
            disabled={!shortcut}
            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-accent"
          >
            <X size={13} />
          </Button>
        </div>
      ) : (
        <div className="shrink-0">{value}</div>
      )}
    </div>
  );
}
