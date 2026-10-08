import { type AiFailureUpdate, aiFailureNotice } from '@mimik/core/capture/ai/errors';
import { TriangleAlert } from 'lucide-react';

export function AiFailureNotice({ failure }: { failure: AiFailureUpdate | null }) {
  if (!failure) return null;

  const { headline, action } = aiFailureNotice(failure.reason, failure.provider);

  return (
    <div className="px-4 pt-2.5 flex items-start gap-2" role="status">
      <TriangleAlert size={13} className="shrink-0 mt-0.5 text-destructive" />
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">{headline}</span> {action}
      </p>
    </div>
  );
}
