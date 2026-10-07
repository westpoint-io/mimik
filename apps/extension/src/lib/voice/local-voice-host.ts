import type { VoiceRequest } from './voice-message';

export interface LocalVoiceHost {
  handle(request: VoiceRequest): Promise<unknown>;
}

export const localVoiceHost: { current: LocalVoiceHost | null } = { current: null };
