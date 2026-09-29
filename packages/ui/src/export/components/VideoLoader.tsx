import { i18n } from '@mimik/core/env';
import type { VideoPreview } from '../hooks/use-video-preview';
import { LoaderMascot } from './LoaderMascot';

interface VideoLoaderProps {
  stage: VideoPreview['stage'];
  narrating: VideoPreview['narrating'];
  progress: number;
  stepCount: number;
}

const FRAMES = Array.from({ length: 8 }, (_, i) => i);

export function VideoLoader({ stage, narrating, progress, stepCount }: VideoLoaderProps) {
  const percent = Math.round(progress * 100);
  const filming = stage === 'video';
  const title = filming
    ? i18n.t('exportPreview.encodingVideo')
    : narrating
      ? i18n.t('exportPreview.narrating', [
          String(Math.min(narrating.done + 1, narrating.total)),
          String(narrating.total),
        ])
      : i18n.t('exportPreview.preparingVoiceover');
  const detail =
    !filming && narrating?.text ? `“${narrating.text}”` : i18n.t('videoPlayer.stepCount', [String(stepCount)]);

  return (
    <div className="flex w-[380px] max-w-[90%] flex-col items-center gap-4 text-center">
      <div className="flex size-[150px] items-center justify-center rounded-full bg-lavender">
        <LoaderMascot filming={filming} />
      </div>

      <div
        className={`relative h-[34px] w-[260px] overflow-hidden rounded bg-primary transition duration-500 motion-reduce:transition-none ${
          filming ? 'opacity-100' : '-translate-y-2.5 opacity-0'
        }`}
        aria-hidden="true"
      >
        <div className="absolute inset-y-0 left-0 flex items-center gap-1 px-1 animate-reel">
          {FRAMES.map((frame) => (
            <span key={frame} className="relative block h-[22px] w-12 rounded-[3px] bg-violet-mid">
              <span className="absolute left-1.5 top-1.5 block h-2.5 w-5 rounded-sm bg-lavender/35" />
            </span>
          ))}
        </div>
      </div>

      <div key={stage} className="flex min-h-12 flex-col items-center gap-1 animate-rise">
        <p className="text-[15px] font-semibold text-foreground">{title}</p>
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{detail}</p>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="flex w-full items-center gap-2.5"
      >
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-150"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="w-9 text-right font-mono text-xs tabular-nums text-foreground">{percent}%</span>
      </div>
    </div>
  );
}
