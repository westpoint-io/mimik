import type { ExportOptions } from '@mimik/core/export/options';
import type { VideoChapter, VoiceoverSkip } from '@mimik/core/export/video-export';
import { canExportVideo } from '@mimik/core/export/video-support';
import type { Guide, Screenshot, Step } from '@mimik/core/guides/types';
import { useEffect, useState } from 'react';
import { exportProgress, MUX_PROGRESS_SHARE, VOICE_PROGRESS_SHARE } from '../lib/export-progress';
import type { VideoMime } from '../types';

const AUTOPLAY_STEP_LIMIT = 25;

export interface VideoPreview {
  supported: boolean;
  url: string | null;
  mime: VideoMime;
  chapters: VideoChapter[];
  progress: number;
  stage: 'voice' | 'video';
  narrating: { done: number; total: number; text?: string } | null;
  voiceoverError: VoiceoverSkip | null;
  error: string | null;
  deferred: boolean;
  request: () => void;
}

interface Params {
  active: boolean;
  guide: Guide;
  steps: Step[];
  screenshots: Map<string, Screenshot>;
  options: ExportOptions;
  voiceover: boolean;
}

export function useVideoPreview({ active, guide, steps, screenshots, options, voiceover }: Params): VideoPreview {
  const [supported, setSupported] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [mime, setMime] = useState<VideoMime>('video/mp4');
  const [chapters, setChapters] = useState<VideoChapter[]>([]);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<'voice' | 'video'>('video');
  const [narrating, setNarrating] = useState<{ done: number; total: number; text?: string } | null>(null);
  const [voiceoverError, setVoiceoverError] = useState<VoiceoverSkip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);

  const { cover, stepDescriptions, resolution } = options;
  const deferred = steps.length > AUTOPLAY_STEP_LIMIT && !requested;

  useEffect(() => {
    let alive = true;
    canExportVideo().then((can) => {
      if (alive) setSupported(can);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!active) setRequested(false);
  }, [active]);

  useEffect(() => {
    if (!active || deferred) return;
    const controller = new AbortController();
    const voiceShare = voiceover ? VOICE_PROGRESS_SHARE : 0;
    const muxShare = voiceover ? MUX_PROGRESS_SHARE : 0;
    let made: string | null = null;
    setError(null);
    setProgress(0);
    setStage(voiceover ? 'voice' : 'video');
    setNarrating(null);
    setVoiceoverError(null);
    const timer = setTimeout(async () => {
      let allClipsLanded = false;
      try {
        const { exportGuideAsVideo } = await import('@mimik/core/export/video-export');
        const built = await exportGuideAsVideo(
          guide,
          steps,
          screenshots,
          { cover, stepDescriptions, resolution, voiceover },
          {
            signal: controller.signal,
            onProgress: (encoded, frames) => {
              if (controller.signal.aborted) return;
              setStage('video');
              setProgress(
                exportProgress.encode(encoded, frames, allClipsLanded ? voiceShare : 0, allClipsLanded ? muxShare : 0),
              );
            },
            onVoiceProgress: (done, total, text) => {
              if (controller.signal.aborted) return;
              allClipsLanded = done === total;
              setNarrating({ done, total, text });
              setProgress(exportProgress.narrate(done, total, voiceShare));
            },
            onMuxProgress: (done, total) => {
              if (!controller.signal.aborted) setProgress(exportProgress.mux(done, total, muxShare));
            },
          },
        );
        if (controller.signal.aborted) return;
        made = URL.createObjectURL(built.blob);
        setMime(built.blob.type === 'video/webm' ? 'video/webm' : 'video/mp4');
        setChapters(built.chapters);
        setVoiceoverError(built.voiceoverError ?? null);
        setUrl(made);
      } catch (err) {
        if (controller.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
      if (made) URL.revokeObjectURL(made);
      setUrl(null);
    };
  }, [active, deferred, guide, steps, screenshots, cover, stepDescriptions, resolution, voiceover]);

  return {
    supported,
    url,
    mime,
    chapters,
    progress,
    stage,
    narrating,
    voiceoverError,
    error,
    deferred,
    request: () => setRequested(true),
  };
}
