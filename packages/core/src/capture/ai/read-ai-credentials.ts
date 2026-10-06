import { localStorage } from '@/core/env';
import { AI_CREDENTIAL_SETTINGS, type AiCredentials, resolveAiCredentials } from './keys';

export async function readAiCredentials(): Promise<AiCredentials | null> {
  return resolveAiCredentials(await localStorage.get([...AI_CREDENTIAL_SETTINGS]));
}
