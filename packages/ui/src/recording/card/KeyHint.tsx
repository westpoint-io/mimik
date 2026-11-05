import { i18n } from '@mimik/core/env';
import { Keyboard } from 'lucide-react';

interface KeyHintProps {
  hidden: boolean;
  shortcut: string;
  messageKey: string;
}

export function KeyHint({ hidden, shortcut, messageKey }: KeyHintProps) {
  const [before, after] = i18n.t(messageKey, ['\u0000']).split('\u0000');
  return (
    <div id="keyHint" hidden={hidden} className="mt-3 flex items-start gap-2 rounded-[9px] bg-secondary px-2.5 py-2">
      <Keyboard size={14} className="mt-0.5 shrink-0 text-accent" />
      <p className="text-[11.5px] leading-[1.55] text-foreground">
        <strong className="font-semibold">{i18n.t('desktop.tipLabel')}</strong> {before}
        <kbd
          id="hintKey"
          className="rounded-[5px] border border-lavender bg-card px-1.5 py-px text-[10.5px] font-semibold whitespace-nowrap"
        >
          {shortcut}
        </kbd>
        {after}
      </p>
    </div>
  );
}
