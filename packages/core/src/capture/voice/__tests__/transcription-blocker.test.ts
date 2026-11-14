import { describe, expect, it } from 'vitest';
import { transcriptionBlocker } from '../transcription-blocker';

describe('transcriptionBlocker', () => {
  it('lets a ready provider through', () => {
    expect(transcriptionBlocker({ provider: 'openai', apiKey: 'sk-test' })).toBeNull();
    expect(transcriptionBlocker({ provider: 'server', apiKey: '', baseUrl: 'http://localhost:8000/v1' })).toBeNull();
  });

  it('blames the key for a hosted provider', () => {
    expect(transcriptionBlocker({ provider: 'groq', apiKey: '' })).toBe('missing-api-key');
    expect(transcriptionBlocker(undefined)).toBe('missing-api-key');
  });

  it('blames the server when it has no usable address', () => {
    expect(transcriptionBlocker({ provider: 'server', apiKey: 'sk-local' })).toBe('server-not-ready');
  });
});
