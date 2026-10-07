import { i18n } from '@mimik/core/env';
import type { StepKind } from '@mimik/core/export/video-export';

const STYLES: Record<StepKind, string> = {
  click: 'border border-border text-foreground',
  type: 'border border-violet-light/50 bg-violet-light/10 text-violet-mid',
  key: 'bg-secondary text-foreground',
  navigate: 'border border-dashed border-border text-muted-foreground',
  note: 'bg-muted text-muted-foreground',
};

export function StepKindBadge({ kind }: { kind: StepKind }) {
  return (
    <span
      className={`inline-block leading-none text-[9px] font-bold uppercase tracking-wide rounded px-1 py-[2px] shrink-0 ${STYLES[kind]}`}
    >
      {i18n.t(`stepKind.${kind}`)}
    </span>
  );
}
