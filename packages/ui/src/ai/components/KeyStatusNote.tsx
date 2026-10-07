import { i18n } from '@mimik/core/env';
import { Check } from 'lucide-react';
import type { KeyStatus } from '../types';

export function KeyStatusNote({ status }: { status: KeyStatus }) {
  if (status === 'checking') {
    return <p className="mt-1 text-[11px] text-muted-foreground">{i18n.t('settings.validatingKey')}</p>;
  }
  if (status === 'valid') {
    return (
      <p className="mt-1 text-[11px] flex items-center gap-1" style={{ color: 'var(--color-success)' }}>
        <Check size={11} />
        {i18n.t('settings.keyValid')}
      </p>
    );
  }
  if (status === 'rejected') {
    return (
      <p className="mt-1 text-[11px] text-destructive" role="alert">
        {i18n.t('settings.keyInvalid')}
      </p>
    );
  }
  if (status === 'unreachable') {
    return <p className="mt-1 text-[11px] text-muted-foreground">{i18n.t('settings.keyUnreachable')}</p>;
  }
  if (status === 'model-required') {
    return (
      <p className="mt-1 text-[11px] text-destructive" role="alert">
        {i18n.t('settings.keyModelRequired')}
      </p>
    );
  }
  if (status === 'model-invalid') {
    return (
      <p className="mt-1 text-[11px] text-destructive" role="alert">
        {i18n.t('settings.keyModelInvalid')}
      </p>
    );
  }
  return null;
}
