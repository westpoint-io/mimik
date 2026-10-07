import type { VideoChapter } from '@mimik/core/export/video-export';

export function activeIndex(chapters: VideoChapter[], time: number): number {
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (time >= chapters[i]!.start) return i;
  }
  return -1;
}
