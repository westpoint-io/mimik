import {
  FullscreenButton,
  MediaPlayer,
  MediaProvider,
  MuteButton,
  PlayButton,
  useMediaRemote,
  useMediaState,
} from '@vidstack/react';
import { ChevronLeft, ChevronRight, Maximize, Minimize, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { i18n } from '#imports';
import type { StepKind, VideoChapter } from '@/core/export/video-export';
import { FRAME_FILL } from '@/core/export/video-support';

const RATES = [1, 1.25, 1.5, 2];

const KIND_DOT: Record<StepKind, string> = {
  click: 'bg-accent',
  type: 'bg-violet-light',
  key: 'bg-violet',
  navigate: 'bg-lavender',
  note: 'bg-muted-foreground',
};

interface VideoStepPlayerProps {
  src: string;
  chapters: VideoChapter[];
  narrated?: boolean;
}

function formatClock(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function activeIndex(chapters: VideoChapter[], time: number): number {
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (time >= chapters[i].start) return i;
  }
  return -1;
}

function StepList({
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
          className={`flex w-full items-start gap-2.5 border-l-2 px-3 py-1.5 text-left transition-colors ${
            i === index ? 'border-l-accent bg-white/10' : 'border-l-transparent hover:bg-white/5'
          }`}
        >
          <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${KIND_DOT[chapter.kind]}`} />
          <span className="min-w-0 flex-1 text-[10.5px] leading-snug text-white/80">{chapter.title}</span>
          <span className="pt-0.5 font-mono text-[9px] tabular-nums text-white/40">{formatClock(chapter.start)}</span>
        </button>
      ))}
    </aside>
  );
}

function PlayerBody({ chapters }: { chapters: VideoChapter[] }) {
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

      {chapters.length > 0 && <StepList chapters={chapters} index={index} onJump={jump} />}
    </>
  );
}

export default function VideoStepPlayer({ src, chapters, narrated = false }: VideoStepPlayerProps) {
  return (
    <MediaPlayer
      src={{ src, type: 'video/mp4' }}
      autoPlay={!narrated}
      muted={!narrated}
      playsInline
      load="eager"
      viewType="video"
      streamType="on-demand"
      className="flex size-full"
      style={{ backgroundColor: FRAME_FILL }}
    >
      <PlayerBody chapters={chapters} />
    </MediaPlayer>
  );
}
