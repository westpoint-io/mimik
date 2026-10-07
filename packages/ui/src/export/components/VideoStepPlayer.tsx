import { i18n } from '@mimik/core/env';
import type { VideoChapter } from '@mimik/core/export/video-export';
import { FRAME_FILL } from '@mimik/core/export/video-support';
import { ChevronLeft, ChevronRight, Maximize, Minimize, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useVideoElement } from '../hooks/use-video-element';
import { activeIndex } from '../lib/active-index';
import { formatClock } from '../lib/format-clock';
import type { VideoMime } from '../types';
import { StepList } from './StepList';
import { StepTimeline } from './StepTimeline';

const ICON_BUTTON =
  'flex size-[34px] items-center justify-center rounded-lg text-foreground hover:bg-secondary disabled:opacity-35 disabled:hover:bg-transparent';

interface VideoStepPlayerProps {
  src: string;
  type: VideoMime;
  chapters: VideoChapter[];
  narrated?: boolean;
}

export function VideoStepPlayer({ src, type, chapters, narrated = false }: VideoStepPlayerProps) {
  const player = useVideoElement(narrated);
  const { time, duration, rate, paused, muted, fullscreen } = player;
  const index = activeIndex(chapters, time);
  const jump = (i: number) => chapters[i] && player.seek(chapters[i].start);

  return (
    <div ref={player.root} className="flex size-full gap-4 bg-secondary p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-[14px] border border-border bg-card p-4">
        <div className="flex min-h-0 flex-1 items-center justify-center" style={{ containerType: 'size' }}>
          <div
            className="overflow-hidden rounded-[10px]"
            style={{ width: 'min(100cqw, 100cqh * 16 / 9)', aspectRatio: '16 / 9', backgroundColor: FRAME_FILL }}
          >
            <video
              ref={player.video}
              autoPlay={!narrated}
              muted={!narrated}
              playsInline
              className="size-full object-contain"
              {...player.events}
            >
              <source src={src} type={type} />
              <track kind="captions" />
            </video>
          </div>
        </div>

        {chapters.length > 0 && <StepTimeline chapters={chapters} time={time} onJump={jump} />}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={player.togglePlay}
            aria-label={i18n.t(paused ? 'videoPlayer.play' : 'videoPlayer.pause')}
            className="flex size-[38px] items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {paused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
          </button>

          <button
            type="button"
            disabled={index <= 0}
            onClick={() => jump(index - 1)}
            aria-label={i18n.t('videoPlayer.previousStep')}
            className={ICON_BUTTON}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            disabled={index < 0 || index >= chapters.length - 1}
            onClick={() => jump(index + 1)}
            aria-label={i18n.t('videoPlayer.nextStep')}
            className={ICON_BUTTON}
          >
            <ChevronRight size={16} />
          </button>

          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {formatClock(time)} / {formatClock(duration)}
          </span>

          <span className="flex-1" />

          <button
            type="button"
            onClick={player.cycleRate}
            aria-label={i18n.t('videoPlayer.speed')}
            className="h-7 rounded-full border border-border px-2.5 font-mono text-[11px] tabular-nums text-foreground hover:bg-secondary"
          >
            {rate}x
          </button>

          <button
            type="button"
            onClick={player.toggleMute}
            aria-label={i18n.t(muted ? 'videoPlayer.unmute' : 'videoPlayer.mute')}
            className={ICON_BUTTON}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          <button
            type="button"
            onClick={player.toggleFullscreen}
            aria-label={i18n.t(fullscreen ? 'videoPlayer.exitFullscreen' : 'videoPlayer.fullscreen')}
            className={ICON_BUTTON}
          >
            {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>
      </div>

      {chapters.length > 0 && (
        <StepList chapters={chapters} index={index} narrated={narrated} playing={!paused} onJump={jump} />
      )}
    </div>
  );
}
