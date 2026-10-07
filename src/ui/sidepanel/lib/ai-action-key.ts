import type { AiFailureReason } from '@/core/capture/ai/errors';

const AI_ACTION_KEYS: Record<AiFailureReason, string> = {
  rejected: 'aiStatus.actionCheckKey',
  'no-credits': 'aiStatus.actionAddCredits',
  'rate-limited': 'aiStatus.actionWait',
  'model-invalid': 'aiStatus.actionPickModel',
  quota: 'aiStatus.actionPickModel',
  network: 'aiStatus.actionConnection',
  unknown: 'aiStatus.actionCheckKey',
};

export function aiActionKey(reason: AiFailureReason | undefined): string {
  const key = reason === undefined ? undefined : AI_ACTION_KEYS[reason];
  return key ?? AI_ACTION_KEYS.unknown;
}
