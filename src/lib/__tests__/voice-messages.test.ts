import { describe, expect, it } from 'vitest';
import { isVoiceMessageFor } from '../voice/is-voice-message-for';
import {
  VOICE_BACKGROUND_TARGET,
  VOICE_OFFSCREEN_TARGET,
  VoiceMessage,
  type VoiceStartRequest,
  voiceMessage,
} from '../voice/voice-message';

describe('voiceMessage', () => {
  it('stamps a timestamp so webext-core ignores the message instead of throwing', () => {
    const message = voiceMessage<VoiceStartRequest>({
      type: VoiceMessage.VOICE_START,
      target: VOICE_OFFSCREEN_TARGET,
    });
    expect(typeof message.timestamp).toBe('number');
  });

  it('keeps the fields it was given', () => {
    const message = voiceMessage<VoiceStartRequest>({
      type: VoiceMessage.VOICE_START,
      target: VOICE_OFFSCREEN_TARGET,
      deviceId: 'mic-1',
    });
    expect(message.type).toBe('VOICE_START');
    expect(message.target).toBe(VOICE_OFFSCREEN_TARGET);
    expect(message.deviceId).toBe('mic-1');
  });
});

describe('isVoiceMessageFor', () => {
  it('accepts a voice message addressed to the given target', () => {
    const message = voiceMessage<VoiceStartRequest>({
      type: VoiceMessage.VOICE_START,
      target: VOICE_OFFSCREEN_TARGET,
    });
    expect(isVoiceMessageFor(VOICE_OFFSCREEN_TARGET, message)).toBe(true);
  });

  it('rejects a voice message addressed to another target', () => {
    const message = voiceMessage<VoiceStartRequest>({
      type: VoiceMessage.VOICE_START,
      target: VOICE_OFFSCREEN_TARGET,
    });
    expect(isVoiceMessageFor(VOICE_BACKGROUND_TARGET, message)).toBe(false);
  });

  it('rejects messages from other protocols', () => {
    expect(isVoiceMessageFor(VOICE_OFFSCREEN_TARGET, { type: 'getState', timestamp: 1 })).toBe(false);
    expect(isVoiceMessageFor(VOICE_OFFSCREEN_TARGET, { target: VOICE_OFFSCREEN_TARGET })).toBe(false);
    expect(isVoiceMessageFor(VOICE_OFFSCREEN_TARGET, null)).toBe(false);
    expect(isVoiceMessageFor(VOICE_OFFSCREEN_TARGET, 'VOICE_START')).toBe(false);
  });

  it('rejects an inherited property masquerading as a message type', () => {
    expect(isVoiceMessageFor(VOICE_OFFSCREEN_TARGET, { type: 'constructor', target: VOICE_OFFSCREEN_TARGET })).toBe(
      false,
    );
  });
});
