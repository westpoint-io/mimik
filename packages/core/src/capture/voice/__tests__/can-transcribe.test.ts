import { describe, expect, it } from 'vitest';
import { canTranscribe } from '../can-transcribe';

describe('canTranscribe', () => {
  it('needs a key for a hosted provider', () => {
    expect(canTranscribe({ provider: 'openai', apiKey: 'sk-test' })).toBe(true);
    expect(canTranscribe({ provider: 'groq', apiKey: '' })).toBe(false);
  });

  it('needs only an address for a server', () => {
    expect(canTranscribe({ provider: 'server', apiKey: '', baseUrl: 'http://localhost:8000/v1' })).toBe(true);
    expect(canTranscribe({ provider: 'server', apiKey: 'sk-local' })).toBe(false);
  });
});
