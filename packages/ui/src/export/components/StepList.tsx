import { i18n } from '@mimik/core/env';
import type { StepKind, VideoChapter } from '@mimik/core/export/video-export';
import { useEffect, useRef } from 'react';
import { formatClock } from '../lib/format-clock';

const KIND_DOT: Record<StepKind, string> = {
  click: 'bg-accent',
  type: 'bg-violet-light',
  key: 'bg-violet',
  navigate: 'bg-lavender',
  note: 'bg-muted-foreground',
};

export function StepList({
  chapters,
  index,
  onJump,
}: {
  chapters: VideoChapter[];
  index: number;
  onJump: (n: number) => void;
}) {
  const list = useRef<HTMLElement>(null);

  useEffect(() => {
    list.current?.querySelectorAll('button')[index]?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  return (
    <aside ref={list} className="w-[228px] shrink-0 overflow-y-auto border-l border-white/10 bg-deep">
      <div className="px-3 pb-2 pt-3 font-mono text-[9px] uppercase tracking-[0.1em] text-white/45">
        {i18n.t('videoPlayer.stepCount', [String(chapters.length)])}
      </div>
      {chapters.map((chapter, i) => (
        <button
          key={chapter.stepId}
          type="button"
          onClick={() => onJump(i)}
          className={`flex w-full items-start gap-2.5 border-l-2 px-3 py-1.5 text-left transition-colors ${i === index ? 'border-l-accent bg-white/10' : 'border-l-transparent hover:bg-white/5'}`}
        >
          <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${KIND_DOT[chapter.kind]}`} />
          <span className="min-w-0 flex-1 text-[10.5px] leading-snug text-white/80">{chapter.title}</span>
          <span className="pt-0.5 font-mono text-[9px] tabular-nums text-white/40">{formatClock(chapter.start)}</span>
        </button>
      ))}
    </aside>
  );
}
