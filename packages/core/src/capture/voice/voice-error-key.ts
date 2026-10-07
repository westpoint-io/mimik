import type { VoiceErrorReason } from './voice-update';

const VOICE_ERROR_KEYS: Record<VoiceErrorReason, string> = {
  'permission-denied': 'voice.errorPermissionDenied',
  'no-device': 'voice.errorNoDevice',
  'no-audio': 'voice.errorNoAudio',
  'missing-api-key': 'voice.errorMissingApiKey',
  'stream-ended': 'voice.errorStreamEnded',
  'not-recording': 'voice.errorNotRecording',
  'already-recording': 'voice.errorAlreadyRecording',
  unsupported: 'voice.errorUnsupported',
  unknown: 'voice.errorUnknown',
};

export function voiceErrorKey(reason: VoiceErrorReason | undefined): string {
  const key = reason === undefined ? undefined : VOICE_ERROR_KEYS[reason];
  return key ?? VOICE_ERROR_KEYS.unknown;
}
