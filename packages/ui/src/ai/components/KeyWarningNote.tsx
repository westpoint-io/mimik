import { i18n } from '@mimik/core/env';
import { TriangleAlert } from 'lucide-react';
import type { KeyWarning } from '../types';

export function KeyWarningNote({ warning }: { warning: KeyWarning | null }) {
  if (!warning) return null;
  return (
    <p className="mt-1 flex items-start gap-1.5 text-[10px] text-foreground leading-relaxed" role="status">
      <TriangleAlert size={11} className="shrink-0 mt-0.5 text-destructive" />
      <span>{i18n.t('settings.keyCannotSpend')}</span>
    </p>
  );
}
