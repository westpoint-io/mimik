import { i18n } from '@mimik/core/env';
import type { VideoChapter } from '@mimik/core/export/video-export';
import { FRAME_FILL } from '@mimik/core/export/video-support';
import {
  FullscreenButton,
  MediaProvider,
  MuteButton,
  PlayButton,
  useMediaRemote,
  useMediaState,
} from '@vidstack/react';
import { ChevronLeft, ChevronRight, Maximize, Minimize, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { activeIndex } from '../lib/active-index';
import { formatClock } from '../lib/format-clock';
import { StepList } from './StepList';
import { StepTimeline } from './StepTimeline';

const RATES = [1, 1.25, 1.5, 2];

const ICON_BUTTON =
  'flex size-[34px] items-center justify-center rounded-lg text-foreground hover:bg-secondary disabled:opacity-35 disabled:hover:bg-transparent';

export function PlayerBody({ chapters, narrated }: { chapters: VideoChapter[]; narrated: boolean }) {
  const remote = useMediaRemote();
  const time = useMediaState('currentTime');
  const duration = useMediaState('duration');
  const rate = useMediaState('playbackRate');
  const paused = useMediaState('paused');
  const fullscreen = useMediaState('fullscreen');
  const muted = useMediaState('muted');

  const index = activeIndex(chapters, time);
  const seekTo = (seconds: number) => remote.seek(Math.max(0, seconds + 0.01));
  const jump = (i: number) => chapters[i] && seekTo(chapters[i].start);

  return (
    <div className="flex size-full gap-4 bg-secondary p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-[14px] border border-border bg-card p-4">
        <div className="flex min-h-0 flex-1 items-center justify-center" style={{ containerType: 'size' }}>
          <div
            className="overflow-hidden rounded-[10px]"
            style={{ width: 'min(100cqw, 100cqh * 16 / 9)', aspectRatio: '16 / 9', backgroundColor: FRAME_FILL }}
          >
            <MediaProvider className="size-full [&_video]:size-full [&_video]:object-contain" />
          </div>
        </div>

        {chapters.length > 0 && <StepTimeline chapters={chapters} time={time} onJump={jump} />}

        <div className="flex items-center gap-2">
          <PlayButton className="flex size-[38px] items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
            {paused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
          </PlayButton>

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
            onClick={() => remote.changePlaybackRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length])}
            aria-label={i18n.t('videoPlayer.speed')}
            className="h-7 rounded-full border border-border px-2.5 font-mono text-[11px] tabular-nums text-foreground hover:bg-secondary"
          >
            {rate}x
          </button>

          <MuteButton
            className={ICON_BUTTON}
            aria-label={muted ? i18n.t('videoPlayer.unmute') : i18n.t('videoPlayer.mute')}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </MuteButton>

          <FullscreenButton className={ICON_BUTTON}>
            {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </FullscreenButton>
        </div>
      </div>

      {chapters.length > 0 && (
        <StepList chapters={chapters} index={index} narrated={narrated} playing={!paused} onJump={jump} />
      )}
    </div>
  );
}
