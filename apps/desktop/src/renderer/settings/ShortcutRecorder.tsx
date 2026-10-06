import { i18n } from '@mimik/core/env';
import { Button } from '@mimik/ui';
import { X } from 'lucide-react';
import { useState } from 'react';
import { shortcutLabel } from '../lib/shortcut-label';
import { accelerator } from './lib/accelerator';

const MAC = navigator.userAgent.includes('Mac');

import { Row } from './Row';

interface ShortcutRecorderProps {
  label: string;
  value: string | null;
  onChange: (accelerator: string | null) => void;
}

export function ShortcutRecorder({ label, value, onChange }: ShortcutRecorderProps) {
  const [listening, setListening] = useState(false);

  return (
    <Row label={label}>
      <div className="flex items-center gap-3">
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
          {listening ? i18n.t('desktop.shortcutPress') : value ? shortcutLabel(value, MAC) : '—'}
        </button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={i18n.t('desktop.shortcutClear')}
          onClick={() => onChange(null)}
          disabled={!value}
          className="rounded-lg text-muted-foreground hover:text-accent"
        >
          <X size={15} />
        </Button>
      </div>
    </Row>
  );
}
