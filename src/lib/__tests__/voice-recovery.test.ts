import { describe, expect, it } from 'vitest';
import { handedOffPcm } from '../voice/handed-off-pcm';
import { isVoiceStatus } from '../voice/is-voice-status';
import { voiceStopAction } from '../voice/voice-stop-action';

describe('isVoiceStatus', () => {
  it('accepts a status response from a live microphone host', () => {
    expect(
      isVoiceStatus({
        recording: true,
        transcribing: false,
        audioEpochMs: 1,
        sampleRate: 16000,
        samples: 4800,
        durationSeconds: 0.3,
      }),
    ).toBe(true);
  });

  it('rejects the undefined a closed sidebar leaves behind', () => {
    expect(isVoiceStatus(undefined)).toBe(false);
    expect(isVoiceStatus(null)).toBe(false);
  });

  it('rejects a reply from another listener that answered first', () => {
    expect(isVoiceStatus({ ok: true })).toBe(false);
    expect(isVoiceStatus({ recording: 'yes', transcribing: false })).toBe(false);
    expect(isVoiceStatus('recording')).toBe(false);
  });
});

describe('handedOffPcm', () => {
  it('keeps samples that crossed the message boundary intact', () => {
    const pcm = Int16Array.of(1, -2, 3);
    expect(handedOffPcm(pcm)).toBe(pcm);
  });

  it('rebuilds samples that arrived as a bare buffer', () => {
    const recovered = handedOffPcm(Int16Array.of(7, 8).buffer);
    expect(recovered).toEqual(Int16Array.of(7, 8));
  });

  it('rebuilds samples that arrived as another view of the same bytes', () => {
    const recovered = handedOffPcm(new Uint8Array(Int16Array.of(-1, 300).buffer));
    expect(recovered).toEqual(Int16Array.of(-1, 300));
  });

  it('refuses a payload that lost its type or carries no audio', () => {
    expect(handedOffPcm({ 0: 1, 1: 2 })).toBeNull();
    expect(handedOffPcm(undefined)).toBeNull();
    expect(handedOffPcm(new Int16Array(0))).toBeNull();
    expect(handedOffPcm(new ArrayBuffer(0))).toBeNull();
  });
});

describe('voiceStopAction', () => {
  it('stops the host that is still answering', () => {
    expect(voiceStopAction({ hostAlive: true, hasOrphanAudio: false, wasRecording: true })).toBe('stop-host');
  });

  it('transcribes audio left behind by a host that died', () => {
    expect(voiceStopAction({ hostAlive: false, hasOrphanAudio: true, wasRecording: true })).toBe('recover');
  });

  it('prefers the handed-off audio over a host that reopened after the loss', () => {
    expect(voiceStopAction({ hostAlive: true, hasOrphanAudio: true, wasRecording: false })).toBe('recover');
  });

  it('reports the loss when a recording host vanished with nothing to salvage', () => {
    expect(voiceStopAction({ hostAlive: false, hasOrphanAudio: false, wasRecording: true })).toBe('report-lost');
  });

  it('stays quiet when narration was never running', () => {
    expect(voiceStopAction({ hostAlive: false, hasOrphanAudio: false, wasRecording: false })).toBe('skip');
  });
});
