import { i18n } from '@mimik/core/env';
import { Button } from '@mimik/ui';
import { AppWindow, Crop, Monitor, Video, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CaptureSettings } from '../main/capture/settings';

type Mode = CaptureSettings['captureMode'];

const MODES: { id: Mode; label: string; Icon: typeof AppWindow }[] = [
  { id: 'window', label: 'desktop_modeWindow', Icon: AppWindow },
  { id: 'screen', label: 'desktop_modeScreen', Icon: Monitor },
  { id: 'region', label: 'desktop_modeRegion', Icon: Crop },
];

export function CaptureSheet({ onClose }: { onClose(): void }) {
  const [settings, setSettings] = useState<CaptureSettings | null>(null);

  useEffect(() => {
    window.mimik.capture.settings.get().then(setSettings);
  }, []);

  const save = async (patch: Partial<CaptureSettings>) => {
    setSettings(await window.mimik.capture.settings.set(patch));
  };

  const start = async () => {
    onClose();
    if (settings?.captureMode === 'region') await window.mimik.capture.edit();
    else await window.mimik.capture.arm();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label={i18n.t('common_close')}
        onClick={onClose}
        className="absolute inset-0 bg-deep/40"
      />

      <aside className="relative flex h-full w-[416px] flex-col border-l border-border bg-card shadow-2xl">
        <div className="flex items-center border-b border-secondary px-6 pb-4 pt-5">
          <h2 className="mr-auto text-base font-semibold text-foreground">{i18n.t('desktop_startSheetTitle')}</h2>
          <button
            type="button"
            aria-label={i18n.t('common_close')}
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X size={17} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 px-6 py-5">
          <div>
            <p className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {i18n.t('desktop_captureMode')}
            </p>
            <div className="flex flex-col gap-2">
              {MODES.map(({ id, label, Icon }) => {
                const active = settings?.captureMode === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => save({ captureMode: id })}
                    className={`flex w-full items-center gap-3.5 rounded-xl bg-clip-padding text-left transition-colors ${
                      active
                        ? 'border-2 border-accent bg-secondary px-[13px] py-3'
                        : 'border border-border bg-card px-[14px] py-[13px] hover:border-accent'
                    }`}
                  >
                    <span
                      className={`flex size-[34px] shrink-0 items-center justify-center rounded-[10px] ${
                        active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                      }`}
                    >
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">{i18n.t(label)}</span>
                    <span
                      className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        active ? 'border-accent' : 'border-border'
                      }`}
                    >
                      {active && <span className="size-2.5 rounded-full bg-accent" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-2.5 border-t border-secondary px-6 pb-5 pt-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {i18n.t('common_cancel')}
          </Button>
          <Button className="flex-[1.6]" disabled={!settings} onClick={start}>
            <Video size={17} />
            {i18n.t('desktop_startButton')}
          </Button>
        </div>
      </aside>
    </div>
  );
}
