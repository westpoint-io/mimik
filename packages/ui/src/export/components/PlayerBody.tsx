import { i18n } from '@mimik/core/env';
import type { VideoChapter } from '@mimik/core/export/video-export';
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

const RATES = [1, 1.25, 1.5, 2];

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
    <>
      <div className="relative min-w-0 flex-1">
        <MediaProvider className="size-full [&_video]:size-full [&_video]:object-contain" />

        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2.5 pt-8 text-white">
          <PlayButton className="rounded-md p-1 hover:bg-white/15">
            {paused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
          </PlayButton>

          <button
            type="button"
            disabled={index <= 0}
            onClick={() => jump(index - 1)}
            aria-label={i18n.t('videoPlayer.previousStep')}
            className="rounded-md p-1 hover:bg-white/15 disabled:opacity-35 disabled:hover:bg-transparent"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            disabled={index < 0 || index >= chapters.length - 1}
            onClick={() => jump(index + 1)}
            aria-label={i18n.t('videoPlayer.nextStep')}
            className="rounded-md p-1 hover:bg-white/15 disabled:opacity-35 disabled:hover:bg-transparent"
          >
            <ChevronRight size={16} />
          </button>

          <span className="font-mono text-[11px] tabular-nums text-white/75">
            {formatClock(time)} / {formatClock(duration)}
          </span>

          <span className="flex-1" />

          <button
            type="button"
            onClick={() => remote.changePlaybackRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length])}
            aria-label={i18n.t('videoPlayer.speed')}
            className="rounded-md px-1.5 py-1 font-mono text-[11px] tabular-nums hover:bg-white/15"
          >
            {rate}x
          </button>

          <MuteButton
            className="rounded-md p-1 hover:bg-white/15"
            aria-label={muted ? i18n.t('videoPlayer.unmute') : i18n.t('videoPlayer.mute')}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </MuteButton>

          <FullscreenButton className="rounded-md p-1 hover:bg-white/15">
            {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </FullscreenButton>
        </div>
      </div>

      {chapters.length > 0 && (
        <StepList chapters={chapters} index={index} narrated={narrated} playing={!paused} onJump={jump} />
      )}
    </>
  );
}
