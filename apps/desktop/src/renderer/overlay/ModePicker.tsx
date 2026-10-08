import { i18n } from '@mimik/core/env';
import { MODES } from './lib/modes';

export function ModePicker({ hidden, mode }: { hidden: boolean; mode: string }) {
  return (
    <div id="modeBlock" hidden={hidden} className="px-3.5 pt-3.5">
      <p className="mb-[7px] text-[10.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {i18n.t('desktop.captureMode')}
      </p>
      <div id="modes" className="flex gap-1.5">
        {MODES.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            data-mode={id}
            aria-pressed={id === mode}
            onClick={() => window.mimikOverlay.command(`mode:${id}`)}
            className={`flex h-8 flex-1 basis-0 items-center justify-center gap-[5px] rounded-lg border px-2 text-[11.5px] font-semibold transition-colors ${
              id === mode
                ? 'border-transparent bg-primary text-white'
                : 'border-lavender bg-card text-foreground hover:border-primary'
            }`}
          >
            <Icon size={13} />
            {i18n.t(label)}
          </button>
        ))}
      </div>
    </div>
  );
}
