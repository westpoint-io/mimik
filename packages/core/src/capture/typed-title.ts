import { i18n } from '@/core/env';

const TYPED_LIMIT = 200;

export function typedTitle(value: string, field: string | null): string {
  const shown = value.replace(/\s+/g, ' ').trim().slice(0, TYPED_LIMIT);
  return field ? i18n.t('steps.typeValueInto', [shown, field]) : i18n.t('steps.type', [shown]);
}
