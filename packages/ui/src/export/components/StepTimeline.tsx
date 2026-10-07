import type { VideoChapter } from '@mimik/core/export/video-export';
import { stepSegments } from '../lib/step-segments';

interface StepTimelineProps {
  chapters: VideoChapter[];
  time: number;
  onJump: (index: number) => void;
}

export function StepTimeline({ chapters, time, onJump }: StepTimelineProps) {
  return (
    <div className="flex gap-[3px]">
      {stepSegments(chapters, time).map((segment, i) => (
        <button
          key={chapters[i]!.stepId}
          type="button"
          aria-label={chapters[i]!.title}
          title={chapters[i]!.title}
          onClick={() => onJump(i)}
          className="group flex h-4 min-w-1 items-center"
          style={{ flexGrow: segment.weight, flexBasis: 0 }}
        >
          <span className="block h-1.5 w-full overflow-hidden rounded-full bg-border group-hover:bg-lavender">
            <span className="block h-full bg-primary" style={{ width: `${segment.played * 100}%` }} />
          </span>
        </button>
      ))}
    </div>
  );
}
