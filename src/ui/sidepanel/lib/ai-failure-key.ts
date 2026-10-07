import type { AiFailureReason } from '@/core/capture/ai/errors';

const AI_FAILURE_KEYS: Record<AiFailureReason, string> = {
  rejected: 'aiStatus.rejected',
  'no-credits': 'aiStatus.noCredits',
  'rate-limited': 'aiStatus.rateLimited',
  'model-invalid': 'aiStatus.modelInvalid',
  quota: 'aiStatus.quota',
  network: 'aiStatus.network',
  unknown: 'aiStatus.unknown',
};

export function aiFailureKey(reason: AiFailureReason | undefined): string {
  const key = reason === undefined ? undefined : AI_FAILURE_KEYS[reason];
  return key ?? AI_FAILURE_KEYS.unknown;
}
