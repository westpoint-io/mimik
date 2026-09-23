import type { ExportOptions } from '@mimik/core/export/options';
import type { VideoChapter } from '@mimik/core/export/video-export';
import { canExportVideo } from '@mimik/core/export/video-support';
import type { Guide, Screenshot, Step } from '@mimik/core/guides/types';
import { useEffect, useState } from 'react';

import type { VideoMime } from '../components/VideoStepPlayer';

const AUTOPLAY_STEP_LIMIT = 25;

export interface VideoPreview {
  supported: boolean;
  url: string | null;
  mime: VideoMime;
  chapters: VideoChapter[];
  progress: number;
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
}

export function useVideoPreview({ active, guide, steps, screenshots, options }: Params): VideoPreview {
  const [supported, setSupported] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [mime, setMime] = useState<VideoMime>('video/mp4');
  const [chapters, setChapters] = useState<VideoChapter[]>([]);
  const [progress, setProgress] = useState(0);
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
    let made: string | null = null;
    setError(null);
    setProgress(0);
    const timer = setTimeout(async () => {
      try {
        const { exportGuideAsVideo } = await import('@mimik/core/export/video-export');
        const built = await exportGuideAsVideo(
          guide,
          steps,
          screenshots,
          { cover, stepDescriptions, resolution },
          {
            signal: controller.signal,
            onProgress: (encoded, frames) => {
              if (!controller.signal.aborted) setProgress(frames > 0 ? encoded / frames : 0);
            },
          },
        );
        if (controller.signal.aborted) return;
        made = URL.createObjectURL(built.blob);
        setMime(built.blob.type === 'video/webm' ? 'video/webm' : 'video/mp4');
        setChapters(built.chapters);
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
  }, [active, deferred, guide, steps, screenshots, cover, stepDescriptions, resolution]);

  return { supported, url, mime, chapters, progress, error, deferred, request: () => setRequested(true) };
}
