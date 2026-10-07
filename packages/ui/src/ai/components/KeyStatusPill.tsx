import { i18n } from '@mimik/core/env';
import { Loader2 } from 'lucide-react';
import type { KeyStatus } from '../types';

const GOOD = 'bg-[#ECFDF5] text-[#047857]';
const BAD = 'bg-[#FEF3F2] text-[#B42318]';
const QUIET = 'bg-secondary text-muted-foreground';
const COMPACT: Record<string, string> = {
  [GOOD]: 'text-[#047857]',
  [BAD]: 'text-[#B42318]',
  [QUIET]: 'text-muted-foreground',
};

const PILLS: Record<NonNullable<KeyStatus>, { label: string; tone: string }> = {
  checking: { label: 'settings.keyChecking', tone: QUIET },
  valid: { label: 'settings.keyVerified', tone: GOOD },
  rejected: { label: 'settings.keyRejected', tone: BAD },
  unreachable: { label: 'settings.keyOffline', tone: QUIET },
  'model-required': { label: 'settings.keyCheckModel', tone: BAD },
  'model-invalid': { label: 'settings.keyCheckModel', tone: BAD },
};

export function KeyStatusPill({
  status,
  compact = false,
  className = '',
}: {
  status: KeyStatus;
  compact?: boolean;
  className?: string;
}) {
  if (!status) return null;
  const pill = PILLS[status];
  const look = compact
    ? `items-center gap-1 text-[10.5px] font-semibold leading-4 ${COMPACT[pill.tone]}`
    : `inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold ${pill.tone}`;
  return (
    <span role="status" className={`${look} ${className}`}>
      {status === 'checking' && <Loader2 size={11} className="animate-spin" />}
      {i18n.t(pill.label)}
    </span>
  );
}
