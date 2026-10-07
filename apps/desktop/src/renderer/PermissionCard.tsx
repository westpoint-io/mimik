import { i18n } from '@mimik/core/env';
import type { LucideIcon } from 'lucide-react';
import { Check, RotateCw } from 'lucide-react';

export function PermissionCard({
  Icon,
  title,
  hint,
  state,
  onGrant,
  onRestart,
}: {
  Icon: LucideIcon;
  title: string;
  hint: string;
  state: 'missing' | 'granted' | 'restart';
  onGrant(): void;
  onRestart(): void;
}) {
  return (
    <div className="flex gap-3.5 rounded-xl border border-border p-[18px]">
      <span className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
        <Icon size={18} />
      </span>
      <div className="flex flex-col items-start gap-1.5">
        <p className="text-[15px] font-semibold text-foreground">{title}</p>
        <p className="mb-1.5 text-[13px] leading-relaxed text-muted-foreground">{hint}</p>
        {state === 'granted' && (
          <span className="inline-flex h-[34px] items-center gap-1.5 rounded-lg bg-success/10 px-3.5 text-[13px] font-semibold text-success">
            <Check size={14} strokeWidth={3} />
            {i18n.t('desktop_permissionGranted')}
          </span>
        )}
        {state === 'restart' && (
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex h-[34px] items-center gap-2 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <RotateCw size={14} />
            {i18n.t('desktop_permissionRestart')}
          </button>
        )}
        {state === 'missing' && (
          <button
            type="button"
            onClick={onGrant}
            className="inline-flex h-[34px] items-center rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {i18n.t('desktop_permissionGrant')}
          </button>
        )}
      </div>
    </div>
  );
}
