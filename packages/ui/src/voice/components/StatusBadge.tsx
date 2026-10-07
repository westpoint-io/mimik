import { i18n } from '@mimik/core/env';
import { Check, Mic, MicOff } from 'lucide-react';
import type { MicrophoneStatus } from '../lib/microphone-status';

const STATUS_STYLES: Record<MicrophoneStatus, string> = {
  allowed: 'bg-success/10 text-success',
  blocked: 'bg-destructive/10 text-destructive',
  pending: 'bg-secondary text-muted-foreground',
};

const STATUS_LABELS: Record<MicrophoneStatus, string> = {
  allowed: 'settings.microphoneStatusAllowed',
  blocked: 'settings.microphoneStatusBlocked',
  pending: 'settings.microphoneStatusPending',
};

export function StatusBadge({ status }: { status: MicrophoneStatus }) {
  const Icon = status === 'allowed' ? Check : status === 'blocked' ? MicOff : Mic;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${STATUS_STYLES[status]}`}
    >
      <Icon size={9} />
      {i18n.t(STATUS_LABELS[status])}
    </span>
  );
}
