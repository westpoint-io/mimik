import type { VideoChapter } from '@mimik/core/export/video-export';

export interface StepSegment {
  weight: number;
  played: number;
}

export function stepSegments(chapters: VideoChapter[], time: number): StepSegment[] {
  return chapters.map((chapter) => {
    const length = Math.max(chapter.end - chapter.start, 0.001);
    return { weight: length, played: Math.min(Math.max((time - chapter.start) / length, 0), 1) };
  });
}
