import { i18n } from '#imports';
import type { DescriptionSource } from '@/core/guides/types';

const STYLES: Record<DescriptionSource, string> = {
  ai: 'bg-secondary text-accent',
  narration: 'bg-success/10 text-success',
  heuristic: 'bg-primary text-primary-foreground',
  manual: 'border border-border text-muted-foreground',
};

const LABELS: Record<DescriptionSource, string> = {
  ai: 'stepSource.ai',
  narration: 'stepSource.voice',
  heuristic: 'stepSource.basic',
  manual: 'stepSource.edited',
};

export default function StepSourceBadge({ source }: { source: DescriptionSource | undefined }) {
  if (!source) return null;

  return (
    <span
      className={`inline-block leading-none text-[9px] font-bold uppercase tracking-wide rounded px-1 py-[2px] shrink-0 ${STYLES[source]}`}
      title={i18n.t('stepSource.hint')}
    >
      {i18n.t(LABELS[source])}
    </span>
  );
}
