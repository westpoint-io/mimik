import { AI_CREDENTIAL_SETTINGS, type AiCredentials, resolveAiCredentials } from '@mimik/core/capture/ai/keys';
import { localStorage } from '@mimik/core/env';

export async function credentials(): Promise<AiCredentials | null> {
  return resolveAiCredentials(await localStorage.get(AI_CREDENTIAL_SETTINGS));
}
