import { i18n } from '@mimik/core/env';
import { Settings } from 'lucide-react';

export default function TopBar({ onSettings }: { onSettings(): void }) {
  return (
    <header className="flex items-center gap-3.5 border-b border-border bg-card px-7 py-3">
      <span className="mr-auto text-[17px] font-semibold tracking-tight text-foreground">{i18n.t('app_name')}</span>

      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span className="size-[7px] rounded-full bg-success" aria-hidden="true" />
        {i18n.t('desktop_readyToRecord')}
      </span>

      <button
        type="button"
        aria-label={i18n.t('settings_title')}
        onClick={onSettings}
        className="flex size-[34px] items-center justify-center rounded-[9px] text-muted-foreground transition-colors hover:bg-secondary hover:text-accent"
      >
        <Settings size={17} />
      </button>
    </header>
  );
}
