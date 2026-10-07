import { describeStep } from '@/core/capture/ai/describe-step';
import { type DOMContext, serializeDOMContext } from '@/core/capture/dom/context';
import { clearStepAiPending } from '@/core/guides/service';
import { broadcastAiToPanel } from '@/lib/port/broadcast-ai-to-panel';

export async function describeDomStep(stepId: string, domContext: DOMContext): Promise<void> {
  const { text, failure } = await describeStep(serializeDOMContext(domContext));
  await clearStepAiPending(stepId, text ?? undefined);
  if (failure) broadcastAiToPanel({ type: 'AI_UPDATE', ...failure });
}
