import { logger } from '@mimik/core/logger';
import type { VoiceRequest } from '../voice/voice-message';
import { request } from './request';

export async function answered<T>(message: VoiceRequest, missing: T): Promise<T> {
  const response = await request<T | undefined>(message).catch((error: unknown) => {
    logger.warn('voice: the microphone host did not answer', message.type, error);
    return undefined;
  });
  return response ?? missing;
}
