import { i18n } from '@mimik/core/env';
import { Check, CircleAlert, Loader2 } from 'lucide-react';
import type { KeyStatus } from '../types';

export function KeyStatusIcon({ status }: { status: KeyStatus }) {
  if (status === 'checking') {
    return (
      <Loader2 size={14} className="animate-spin text-muted-foreground" aria-label={i18n.t('settings.validatingKey')} />
    );
  }
  if (status === 'valid') {
    return (
      <Check
        size={14}
        strokeWidth={3}
        style={{ color: 'var(--color-success)' }}
        aria-label={i18n.t('settings.keyValid')}
      />
    );
  }
  if (status === null) return null;
  return <CircleAlert size={14} className={status === 'unreachable' ? 'text-muted-foreground' : 'text-destructive'} />;
}
