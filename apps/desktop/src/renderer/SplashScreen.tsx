import { i18n } from '@mimik/core/env';
import { MascotIcon } from '@mimik/ui';

export function SplashScreen() {
  return (
    <main className="box-border flex h-full flex-col items-center justify-center gap-3.5 rounded-[14px] border border-lavender bg-[#f5f6fb]">
      <div
        id="mascot"
        className="flex [&_svg>path:nth-of-type(4)]:origin-center [&_svg>path:nth-of-type(4)]:animate-[wink_3.2s_ease_infinite] [&_svg>path:nth-of-type(4)]:[transform-box:fill-box]"
      >
        <MascotIcon size={116} />
      </div>
      <p id="wordmark" className="text-[22px] font-bold tracking-[-0.01em] text-foreground">
        Mimik
      </p>
      <div
        id="meter"
        role="progressbar"
        aria-label={i18n.t('common.loading')}
        className="relative h-[3px] w-[140px] overflow-hidden rounded-[3px] bg-lavender"
      >
        <span className="absolute top-0 left-0 h-[3px] w-2/5 animate-[sweep_1.6s_ease-in-out_infinite] rounded-[3px] bg-accent" />
      </div>
    </main>
  );
}
