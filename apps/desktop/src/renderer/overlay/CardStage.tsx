import { splitAtShortcut } from '@mimik/core/capture/split-at-shortcut';
import { i18n } from '@mimik/core/env';
import { StepSourceBadge, Tooltip, TooltipContent, TooltipTrigger } from '@mimik/ui';
import { Pause, Trash2 } from 'lucide-react';
import type { ReactNode, Ref } from 'react';
import type { OverlayStep } from '../../main/overlay';

interface CardStageProps {
  stageRef: Ref<HTMLDivElement>;
  previewRef: Ref<HTMLDivElement>;
  titleRef: Ref<HTMLParagraphElement>;
  step: OverlayStep | null;
  hidden: boolean;
  capturing: boolean;
  paused: boolean;
  armed: boolean;
  arrived: boolean;
  shotSrc: string | null;
  onShotLoad: () => void;
  children: ReactNode;
}

export function CardStage({
  stageRef,
  previewRef,
  titleRef,
  step,
  hidden,
  capturing,
  paused,
  armed,
  arrived,
  shotSrc,
  onShotLoad,
  children,
}: CardStageProps) {
  const title = step?.title ?? ' ';
  const split = splitAtShortcut(title, step?.action);
  const away = capturing ? 'invisible' : '';
  const arrive = arrived ? 'animate-[arrive_0.26s_ease-out_both]' : '';
  const meta =
    [step ? i18n.t('export.stepLabel', [String(step.number)]) : '', step?.app ?? ''].filter(Boolean).join(' · ') || ' ';

  return (
    <div id="stage" ref={stageRef} hidden={hidden} className="relative">
      <div
        id="preview"
        ref={previewRef}
        className={`relative h-[calc(150px-var(--title-extra,0px))] overflow-hidden rounded-[10px] border border-lavender/50 bg-secondary ${away}`}
      >
        <img
          id="shot"
          src={shotSrc ?? undefined}
          alt=""
          hidden={!step?.src}
          onLoad={onShotLoad}
          className="block size-full object-contain"
        />
        <div
          id="veil"
          hidden={!paused || capturing}
          className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-white/55"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-primary text-white">
            <Pause size={16} />
          </span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              id="remove"
              type="button"
              hidden={!step || capturing || armed}
              aria-label={i18n.t('recording.deleteStep')}
              onClick={() => window.mimikOverlay.command('deleteStep')}
              className={`absolute top-2 right-2 flex size-7 items-center justify-center rounded-lg bg-white/95 text-foreground hover:text-destructive ${arrive}`}
            >
              <Trash2 size={13} />
            </button>
          </TooltipTrigger>
          <TooltipContent>{i18n.t('recording.deleteStep')}</TooltipContent>
        </Tooltip>
      </div>
      <p
        id="stepTitle"
        ref={titleRef}
        className={`mt-[11px] line-clamp-2 text-[13px] leading-[1.45] font-semibold ${away} ${arrive}`}
      >
        {split ? (
          <>
            {split[0]}
            <kbd className="rounded-[5px] border border-lavender bg-card px-1.5 py-px text-[0.85em] font-semibold whitespace-nowrap">
              {split[1]}
            </kbd>
            {split[2]}
          </>
        ) : (
          title
        )}
      </p>
      <div
        id="stepMeta"
        className={`mt-[5px] flex items-center gap-1.5 text-[11px] text-muted-foreground ${away} ${arrive}`}
      >
        <span id="source" hidden={!step} className="flex">
          <StepSourceBadge source={step?.source ?? 'heuristic'} />
        </span>
        <span id="metaText">{meta}</span>
      </div>
      {children}
    </div>
  );
}
