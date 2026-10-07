import { i18n } from '@mimik/core/env';
import { Check } from 'lucide-react';

export function SavedBadge({ saved, className = '' }: { saved: boolean; className?: string }) {
  return (
    <span
      aria-live="polite"
      className={`ml-auto flex items-center gap-1 text-[11px] font-semibold transition-opacity duration-300 ${
        saved ? 'opacity-100' : 'opacity-0'
      } ${className}`}
      style={{ color: 'var(--color-success)' }}
    >
      <Check size={12} />
      {i18n.t('settings.saved')}
    </span>
  );
}
