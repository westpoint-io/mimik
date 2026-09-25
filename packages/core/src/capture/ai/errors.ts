import { i18n } from '@/core/env';
import { findProvider } from './models';

export type AiFailureReason =
  | 'rejected'
  | 'no-credits'
  | 'rate-limited'
  | 'model-invalid'
  | 'quota'
  | 'network'
  | 'unknown';

export interface AiFailure {
  reason: AiFailureReason;
  status?: number;
  message: string;
}

function statusOf(err: unknown): number | undefined {
  let current = err;
  for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth += 1) {
    const status = (current as { statusCode?: unknown }).statusCode;
    if (typeof status === 'number') return status;
    current = (current as { lastError?: unknown; cause?: unknown }).lastError ?? (current as { cause?: unknown }).cause;
  }
  return undefined;
}

function messageOf(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return String(err);
}

export function describeAiFailure(err: unknown): AiFailure {
  const status = statusOf(err);
  const message = messageOf(err);

  if (status === 401 || status === 403) return { reason: 'rejected', status, message };
  if (status === 402) return { reason: 'no-credits', status, message };
  if (status === 429) return { reason: 'rate-limited', status, message };
  if (status === 404) return { reason: 'model-invalid', status, message };
  if (status === 413) return { reason: 'quota', status, message };
  if (status !== undefined) return { reason: 'network', status, message };
  return { reason: 'unknown', message };
}

const AI_FAILURE_KEYS: Record<AiFailureReason, string> = {
  rejected: 'aiStatus.rejected',
  'no-credits': 'aiStatus.noCredits',
  'rate-limited': 'aiStatus.rateLimited',
  'model-invalid': 'aiStatus.modelInvalid',
  quota: 'aiStatus.quota',
  network: 'aiStatus.network',
  unknown: 'aiStatus.unknown',
};

const AI_ACTION_KEYS: Record<AiFailureReason, string> = {
  rejected: 'aiStatus.actionCheckKey',
  'no-credits': 'aiStatus.actionAddCredits',
  'rate-limited': 'aiStatus.actionWait',
  'model-invalid': 'aiStatus.actionPickModel',
  quota: 'aiStatus.actionPickModel',
  network: 'aiStatus.actionConnection',
  unknown: 'aiStatus.actionCheckKey',
};

export function aiFailureKey(reason: AiFailureReason | undefined): string {
  return (reason && AI_FAILURE_KEYS[reason]) ?? AI_FAILURE_KEYS.unknown;
}

export function aiActionKey(reason: AiFailureReason | undefined): string {
  return (reason && AI_ACTION_KEYS[reason]) ?? AI_ACTION_KEYS.unknown;
}

export function aiFailureNotice(
  reason: AiFailureReason | undefined,
  provider: string,
): { headline: string; action: string } {
  const label = findProvider(provider)?.label ?? provider;
  return { headline: i18n.t(aiFailureKey(reason), [label]), action: i18n.t(aiActionKey(reason)) };
}
