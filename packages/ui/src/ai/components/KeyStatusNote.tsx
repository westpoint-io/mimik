import { i18n } from '@mimik/core/env';
import type { KeyStatus } from '../types';

export function KeyStatusNote({ status }: { status: KeyStatus }) {
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
