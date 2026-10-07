import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMicPermission = vi.fn();
const startVoiceCapture = vi.fn();
const openMicPermissionPage = vi.fn();
const storageSet = vi.fn();

vi.mock('@/lib/offscreen/supports-voice', () => ({ supportsVoice: () => true }));
vi.mock('@/lib/offscreen/ensure-voice-host', () => ({ ensureVoiceHost: vi.fn().mockResolvedValue(true) }));
vi.mock('@/lib/offscreen/query-mic-permission', () => ({
  queryMicPermission: (...args: unknown[]) => queryMicPermission(...args),
}));
vi.mock('@/lib/offscreen/start-voice-capture', () => ({
  startVoiceCapture: (...args: unknown[]) => startVoiceCapture(...args),
}));
vi.mock('@/lib/offscreen/open-mic-permission-page', () => ({
  openMicPermissionPage: (...args: unknown[]) => openMicPermissionPage(...args),
}));
vi.mock('@/lib/offscreen/stop-voice-capture', () => ({ stopVoiceCapture: vi.fn() }));
vi.mock('@/lib/offscreen/has-voice-host', () => ({ hasVoiceHost: vi.fn().mockResolvedValue(false) }));
vi.mock('@/lib/offscreen/close-voice-host-if-idle', () => ({ closeVoiceHostIfIdle: vi.fn() }));
vi.mock('@/lib/offscreen/close-voice-host', () => ({ closeVoiceHost: vi.fn() }));
vi.mock('@/lib/offscreen/abort-voice-capture', () => ({ abortVoiceCapture: vi.fn() }));
vi.mock('@/lib/offscreen/flush-voice-capture', () => ({ flushVoiceCapture: vi.fn() }));
vi.mock('@/lib/offscreen/register-voice-panel-relay', () => ({ registerVoicePanelRelay: vi.fn() }));
vi.mock('@/lib/browser-api/on-message', () => ({ onMessage: vi.fn() }));
vi.mock('@/lib/port/broadcast-voice-to-panel', () => ({ broadcastVoiceToPanel: vi.fn() }));
vi.mock('@/core/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/env')>()),
  localStorage: {
    get: vi.fn().mockResolvedValue({ voiceEnabled: true, voiceProvider: 'openai', voiceApiKey: 'sk-test' }),
    set: (...args: unknown[]) => storageSet(...args),
  },
}));

import { startVoiceNarration } from '../voice';

beforeEach(() => {
  vi.clearAllMocks();
  startVoiceCapture.mockResolvedValue({ started: true });
});

describe('a refused microphone', () => {
  it('switches narration off when the browser has the microphone blocked', async () => {
    queryMicPermission.mockResolvedValue({ state: 'denied' });

    await startVoiceNarration(1);

    expect(storageSet).toHaveBeenCalledWith({ voiceEnabled: false });
    expect(openMicPermissionPage).not.toHaveBeenCalled();
  });

  it('switches narration off when the microphone is refused as recording starts', async () => {
    queryMicPermission.mockResolvedValue({ state: 'granted' });
    startVoiceCapture.mockResolvedValue({ started: false, reason: 'permission-denied', error: 'refused' });

    await startVoiceNarration(1);

    expect(storageSet).toHaveBeenCalledWith({ voiceEnabled: false });
  });

  it('asks for the microphone the first time instead of switching narration off', async () => {
    queryMicPermission.mockResolvedValue({ state: 'prompt' });

    await startVoiceNarration(1);

    expect(openMicPermissionPage).toHaveBeenCalled();
    expect(storageSet).not.toHaveBeenCalledWith({ voiceEnabled: false });
  });
});
