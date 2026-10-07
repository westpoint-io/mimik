import { sendMessage } from '../browser-api/send-message';
import { localVoiceHost } from '../voice/local-voice-host';
import type { VoiceRequest } from '../voice/voice-message';
import { IS_FIREFOX } from './constants';

export function request<T>(message: VoiceRequest): Promise<T> {
  const local = IS_FIREFOX ? localVoiceHost.current : null;
  if (local) return local.handle(message) as Promise<T>;
  return sendMessage(message as unknown as Record<string, unknown>) as Promise<T>;
}
