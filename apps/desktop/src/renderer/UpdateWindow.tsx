import { i18n } from '@mimik/core/env';
import { Button } from '@mimik/ui';
import { Download, X } from 'lucide-react';
import { useEffect } from 'react';
import { useUpdateStatus } from './hooks/use-update-status';

export function UpdateWindow() {
  const status = useUpdateStatus();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') window.close();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  return (
    <main
      aria-labelledby="update-title"
      className="relative box-border flex h-full flex-col justify-between gap-4 rounded-xl border border-border bg-card p-5 text-foreground"
    >
      <button
        type="button"
        aria-label={i18n.t('common.close')}
        onClick={() => window.close()}
        className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-ghost-hover hover:text-foreground"
      >
        <X size={14} />
      </button>
      <div className="flex items-start gap-3.5 pr-6">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-icon-tile text-accent">
          <Download size={20} />
        </span>
        <span className="flex flex-col gap-1">
          <h1 id="update-title" className="m-0 text-[15px] font-semibold">
            {i18n.t('desktop.updateReady')}
          </h1>
          <p className="m-0 text-[13px] leading-normal text-muted-foreground">
            {i18n.t('desktop.updateReadyMessage', [status?.version ?? ''])}
          </p>
          <button
            type="button"
            onClick={() => window.mimik.updates.notes()}
            className="self-start text-xs font-medium text-accent underline-offset-2 hover:underline"
          >
            {i18n.t('common.whatsNew')}
          </button>
        </span>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => window.close()}>
          {i18n.t('desktop.later')}
        </Button>
        <Button size="sm" onClick={() => window.mimik.updates.install()}>
          {i18n.t('desktop.restart')}
        </Button>
      </div>
    </main>
  );
}
