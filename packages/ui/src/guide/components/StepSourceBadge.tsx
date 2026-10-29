import { i18n } from '@mimik/core/env';
import { STEP_SOURCE_LABELS } from '@mimik/core/guides/step-source-labels';
import type { DescriptionSource } from '@mimik/core/guides/types';
import { Cog, type LucideIcon, Mic, Pencil, Sparkles } from 'lucide-react';

const STYLES: Record<DescriptionSource, string> = {
  ai: 'bg-badge-ai text-badge-ai-foreground',
  narration: 'bg-badge-voice text-badge-voice-foreground',
  heuristic: 'bg-badge-basic text-badge-basic-foreground',
  manual: 'bg-badge-edited text-badge-edited-foreground',
};

const ICONS: Record<DescriptionSource, LucideIcon> = {
  ai: Sparkles,
  narration: Mic,
  heuristic: Cog,
  manual: Pencil,
};

export function StepSourceBadge({ source }: { source: DescriptionSource | undefined }) {
  if (!source) return null;
  const Icon = ICONS[source];

  return (
    <span
      className={`inline-flex items-center gap-1 leading-none text-[9px] font-bold uppercase tracking-wide rounded-full px-1.5 py-[3px] shrink-0 ${STYLES[source]}`}
      title={i18n.t('stepSource.hint')}
    >
      <Icon size={8} strokeWidth={2.75} aria-hidden="true" />
      {i18n.t(STEP_SOURCE_LABELS[source])}
    </span>
  );
}
