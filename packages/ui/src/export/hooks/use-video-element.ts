import { type SyntheticEvent, useCallback, useEffect, useRef, useState } from 'react';

const RATES = [1, 1.25, 1.5, 2];

type VideoEvent = SyntheticEvent<HTMLVideoElement>;

export function useVideoElement(narrated: boolean) {
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [paused, setPaused] = useState(true);
  const [muted, setMuted] = useState(!narrated);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const seek = useCallback((seconds: number) => {
    if (video.current) video.current.currentTime = Math.max(0, seconds + 0.01);
  }, []);

  return {
    root,
    video,
    time,
    duration,
    rate,
    paused,
    muted,
    fullscreen,
    seek,
    togglePlay: () => {
      const element = video.current;
      if (!element) return;
      if (element.paused) void element.play();
      else element.pause();
    },
    cycleRate: () => {
      if (video.current) video.current.playbackRate = RATES[(RATES.indexOf(rate) + 1) % RATES.length]!;
    },
    toggleMute: () => {
      if (video.current) video.current.muted = !video.current.muted;
    },
    toggleFullscreen: () => {
      if (document.fullscreenElement === root.current) void document.exitFullscreen();
      else void root.current?.requestFullscreen();
    },
    events: {
      onDurationChange: (event: VideoEvent) => setDuration(event.currentTarget.duration),
      onPause: () => setPaused(true),
      onPlay: () => setPaused(false),
      onRateChange: (event: VideoEvent) => setRate(event.currentTarget.playbackRate),
      onSeeked: (event: VideoEvent) => setTime(event.currentTarget.currentTime),
      onTimeUpdate: (event: VideoEvent) => setTime(event.currentTarget.currentTime),
      onVolumeChange: (event: VideoEvent) => setMuted(event.currentTarget.muted),
    },
  };
}
