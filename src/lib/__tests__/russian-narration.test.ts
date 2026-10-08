import { describe, expect, it, vi } from 'vitest';

vi.mock('@/core/capture/voice/api-key', () => ({
  VOICE_KEY_SETTINGS: [],
  resolveVoiceApiKey: () => ({ provider: 'openai', apiKey: 'test-key' }),
}));
vi.mock('@/core/capture/voice/energy-gate', () => ({ detectSpeechByEnergy: vi.fn() }));
vi.mock('@/core/capture/voice/pipeline', () => ({ runNarrationPipeline: vi.fn() }));
vi.mock('@/core/capture/voice/step-windows', () => ({ buildStepWindows: vi.fn() }));
vi.mock('@/core/capture/voice/transcribe', () => ({ createTranscriber: vi.fn() }));
vi.mock('@/lib/browser-api', () => ({ localStorage: { get: vi.fn() } }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

import { localStorage } from '@/lib/browser-api';
import { readTranscriptionSettings } from '../voice-narration';

describe('Russian narration language', () => {
  it.each(['ru', 'ru-RU', 'ru-KZ'])('uses AI language %s when no voice override is set', async (locale) => {
    vi.mocked(localStorage.get).mockResolvedValue({ aiLanguage: locale });
    expect((await readTranscriptionSettings()).language).toBe('ru');
  });

  it('respects an explicit English voice setting', async () => {
    vi.mocked(localStorage.get).mockResolvedValue({ aiLanguage: 'ru', voiceLanguage: 'en-US' });
    expect((await readTranscriptionSettings()).language).toBe('en');
  });

  it('uses a Russian voice override independently of the AI language', async () => {
    vi.mocked(localStorage.get).mockResolvedValue({ aiLanguage: 'en', voiceLanguage: 'ru-RU' });
    expect((await readTranscriptionSettings()).language).toBe('ru');
  });

  it('preserves automatic detection when explicitly selected', async () => {
    vi.mocked(localStorage.get).mockResolvedValue({ aiLanguage: 'ru', voiceLanguage: '' });
    expect((await readTranscriptionSettings()).language).toBeUndefined();
  });

  it('does not force Russian on an unconfigured profile', async () => {
    vi.mocked(localStorage.get).mockResolvedValue({});
    expect((await readTranscriptionSettings()).language).toBeUndefined();
  });
});
