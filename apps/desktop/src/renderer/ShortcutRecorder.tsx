import { i18n } from '@mimik/core/env';
import { X } from 'lucide-react';
import { useState } from 'react';

const MODIFIERS = new Set(['Control', 'Alt', 'Shift', 'Meta']);

export function accelerator(event: React.KeyboardEvent): string | null {
  if (MODIFIERS.has(event.key)) return null;
  const held: string[] = [];
  if (event.metaKey) held.push('Super');
  if (event.ctrlKey) held.push('Control');
  if (event.altKey) held.push('Alt');
  if (event.shiftKey) held.push('Shift');
  if (held.length === 0) return null;
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  return [...held, key].join('+');
}

interface ShortcutRecorderProps {
  label: string;
  value: string | null;
  onChange: (accelerator: string | null) => void;
}

export default function ShortcutRecorder({ label, value, onChange }: ShortcutRecorderProps) {
  const [listening, setListening] = useState(false);

  return (
    <div className="flex items-center gap-3">
      <span className="mr-auto text-sm text-foreground">{label}</span>
      <button
        type="button"
        onKeyDown={(event) => {
          if (!listening) return;
          event.preventDefault();
          const next = accelerator(event);
          if (!next) return;
          onChange(next);
          setListening(false);
        }}
        onClick={() => setListening(true)}
        onBlur={() => setListening(false)}
        className={`h-9 min-w-[188px] rounded-[10px] border px-3 text-[13px] font-medium transition-colors ${
          listening
            ? 'border-accent text-accent ring-2 ring-accent/25'
            : 'border-border bg-card text-foreground hover:border-violet'
        }`}
      >
        {listening ? i18n.t('desktop_shortcutPress') : (value ?? '—')}
      </button>
      <button
        type="button"
        aria-label={i18n.t('desktop_shortcutClear')}
        onClick={() => onChange(null)}
        disabled={!value}
        className="flex size-9 items-center justify-center rounded-[10px] border border-border bg-card text-muted-foreground hover:text-accent disabled:opacity-35"
      >
        <X size={15} />
      </button>
    </div>
  );
}
