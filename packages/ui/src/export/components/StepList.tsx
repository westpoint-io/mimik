import { i18n } from '@mimik/core/env';
import type { VideoChapter } from '@mimik/core/export/video-export';
import { useEffect, useRef } from 'react';
import { formatClock } from '../lib/format-clock';
import { SpokenMark } from './SpokenMark';
import { StepKindBadge } from './StepKindBadge';

export function StepList({
  chapters,
  index,
  narrated,
  playing,
  onJump,
}: {
  chapters: VideoChapter[];
  index: number;
  narrated: boolean;
  playing: boolean;
  onJump: (n: number) => void;
}) {
  const list = useRef<HTMLElement>(null);

  useEffect(() => {
    list.current?.querySelectorAll('button')[index]?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  return (
    <aside
      ref={list}
      className="flex w-[290px] shrink-0 flex-col overflow-hidden rounded-[14px] border border-border bg-card"
    >
      <div className="flex items-baseline justify-between px-4 pb-2 pt-3.5">
        <span className="text-xs font-bold text-foreground">
          {i18n.t('videoPlayer.stepCount', [String(chapters.length)])}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {formatClock(chapters[chapters.length - 1]?.end ?? 0)}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {chapters.map((chapter, i) => (
          <button
            key={chapter.stepId}
            type="button"
            onClick={() => onJump(i)}
            className={`flex w-full items-start gap-2.5 px-3.5 py-1.5 text-left transition-colors ${
              i === index ? 'bg-secondary' : 'hover:bg-secondary/50'
            }`}
          >
            <span
              className={`mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                i === index ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
              }`}
            >
              {i + 1}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[11.5px] leading-snug text-foreground">{chapter.title}</span>
              <span className="flex items-center gap-1.5">
                <StepKindBadge kind={chapter.kind} />
                {narrated && chapter.spoken && <SpokenMark talking={playing && i === index} />}
              </span>
            </span>
            <span className="pt-0.5 font-mono text-[9px] tabular-nums text-muted-foreground">
              {formatClock(chapter.start)}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
