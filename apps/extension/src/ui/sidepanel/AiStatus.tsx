import { TriangleAlert } from 'lucide-react';
import { aiFailureNotice } from '@/core/capture/ai/errors';
import type { PanelAiUpdate } from '@/lib/port/types';

interface AiStatusProps {
  update: PanelAiUpdate | null;
}

export function AiStatus({ update }: AiStatusProps) {
  if (!update) return null;

  const { headline, action } = aiFailureNotice(update.reason, update.provider);

  return (
    <div className="px-4 pt-2.5 flex items-start gap-2" role="status">
      <TriangleAlert size={13} className="shrink-0 mt-0.5 text-destructive" />
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">{headline}</span> {action}
      </p>
    </div>
  );
}
