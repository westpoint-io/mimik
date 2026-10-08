import { DemoCursor, MascotIcon } from '@mimik/ui';
import { Pin, Puzzle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { i18n } from '#imports';
import { isPinnedToToolbar } from '@/lib/browser-api/is-pinned-to-toolbar';
import { puzzleIconOffset } from '@/lib/browser-api/puzzle-icon-offset';

const POLL_MS = 1500;
const ARROW_HALF = 8;
const EDGE_GAP = 14;
const ARROW_INSET = 24;

export function PinCard() {
  const [pinned, setPinned] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    const check = () =>
      void isPinnedToToolbar().then((next) => {
        if (live) setPinned(next);
      });
    check();
    const timer = window.setInterval(check, POLL_MS);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, []);

  if (pinned) return null;

  const offset = puzzleIconOffset();
  const right = Math.max(EDGE_GAP, offset - ARROW_HALF - ARROW_INSET - 60);
  const arrow = offset - right - ARROW_HALF;

  return (
    <section className="flex flex-col items-center gap-3 rounded-[18px] border border-lavender/60 bg-card px-7 py-6 text-center lg:row-span-3 lg:grid lg:grid-rows-subgrid lg:items-stretch lg:justify-items-center">
      <div
        style={{ right, ['--arrow' as string]: `${arrow}px` }}
        className="fixed top-2.5 z-10 flex animate-[bob_1.4s_ease-in-out_infinite] items-center gap-2.5 rounded-xl bg-primary px-4 py-3 text-[14px] font-semibold text-white shadow-[0_10px_24px_rgba(30,27,75,0.25)] motion-reduce:animate-none before:absolute before:-top-2 before:right-[var(--arrow)] before:border-8 before:border-t-0 before:border-transparent before:border-b-primary"
      >
        <span className="flex size-[30px] items-center justify-center rounded-full bg-white text-primary">
          <Puzzle size={17} className="fill-primary" />
        </span>
        {i18n.t('onboarding.pinHere')}
      </div>

      <h2 className="text-[20px] font-bold text-foreground">{i18n.t('onboarding.pinCardTitle')}</h2>
      <p className="-mt-1 max-w-[52ch] text-[13.5px] text-muted-foreground lg:mt-0 lg:self-center">
        {i18n.t('onboarding.pinCardMessage')}
      </p>
      <div className="w-full max-w-[420px] overflow-hidden rounded-xl border border-lavender/60 bg-background text-left">
        <div className="flex items-center gap-2 bg-gray-200/70 px-2.5 py-2">
          <span className="flex gap-1">
            <i className="size-2 rounded-full bg-gray-300" />
            <i className="size-2 rounded-full bg-gray-300" />
            <i className="size-2 rounded-full bg-gray-300" />
          </span>
          <span className="h-4 flex-1 rounded-full bg-white" />
          <span className="flex size-[18px] items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
            1
          </span>
          <Puzzle size={16} />
        </div>
        <div className="mt-2 mr-7 mb-3.5 ml-auto w-[230px] max-w-[calc(100%-20px)] animate-[ob-pin-menu_6s_ease_infinite] rounded-[10px] border border-gray-200 bg-white p-2 text-[11.5px] opacity-0 shadow-[0_8px_20px_rgba(15,12,45,0.14)] motion-reduce:animate-none motion-reduce:opacity-100">
          <p className="px-1 pb-1.5 text-[10.5px] font-semibold text-muted-foreground">
            {i18n.t('onboarding.pinMenuTitle')}
          </p>
          <div className="flex items-center gap-2 rounded-md bg-secondary px-1 py-1.5">
            <MascotIcon size={20} />
            Mimik
            <span className="ml-auto flex items-center gap-1.5">
              <span className="flex size-[18px] items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                2
              </span>
              <span className="relative inline-flex animate-[ob-pin-fill_6s_step-end_infinite] text-muted-foreground motion-reduce:animate-none">
                <Pin size={15} />
                <DemoCursor className="top-[55%] left-[55%] size-[18px] animate-[ob-pin-cursor-b_6s_ease-in-out_infinite] opacity-0 motion-reduce:hidden" />
              </span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
