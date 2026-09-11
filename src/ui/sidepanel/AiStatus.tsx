import { TriangleAlert } from 'lucide-react';
import { i18n } from '#imports';
import { findProvider } from '@/core/capture/ai/models';
import type { PanelAiUpdate } from '@/lib/port';
import { aiActionKey, aiFailureKey } from './ai-status';

interface AiStatusProps {
  update: PanelAiUpdate | null;
}

export default function AiStatus({ update }: AiStatusProps) {
  if (!update) return null;

  const label = findProvider(update.provider)?.label ?? update.provider;

  return (
    <div className="px-4 pt-2.5 flex items-start gap-2" role="status">
      <TriangleAlert size={13} className="shrink-0 mt-0.5 text-destructive" />
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">{i18n.t(aiFailureKey(update.reason), [label])}</span>{' '}
        {i18n.t(aiActionKey(update.reason))}
      </p>
    </div>
  );
}
