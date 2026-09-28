import { i18n } from '@mimik/core/env';

const WAVE_BARS = [3, 7, 4, 8, 5];

export function SpokenMark({ talking }: { talking: boolean }) {
  return (
    <span role="img" aria-label={i18n.t('videoPlayer.spoken')} className="mt-1 flex shrink-0 items-center gap-[2px]">
      {WAVE_BARS.map((height, i) => (
        <span
          key={height}
          className={`w-[2px] rounded-[1px] ${talking ? 'animate-talk bg-lavender' : 'bg-lavender/70'}`}
          style={{ height: `${height}px`, animationDelay: talking ? `${i * 90}ms` : undefined }}
        />
      ))}
    </span>
  );
}
