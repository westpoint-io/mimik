import type { VideoChapter } from '@mimik/core/export/video-export';
import { MediaPlayer } from '@vidstack/react';
import type { VideoMime } from '../types';
import { PlayerBody } from './PlayerBody';

interface VideoStepPlayerProps {
  src: string;
  type: VideoMime;
  chapters: VideoChapter[];
  narrated?: boolean;
}

export function VideoStepPlayer({ src, type, chapters, narrated = false }: VideoStepPlayerProps) {
  return (
    <MediaPlayer
      src={{ src, type }}
      autoPlay={!narrated}
      muted={!narrated}
      playsInline
      load="eager"
      viewType="video"
      streamType="on-demand"
      className="flex size-full"
    >
      <PlayerBody chapters={chapters} narrated={narrated} />
    </MediaPlayer>
  );
}
