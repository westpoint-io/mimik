import { describe, expect, it } from 'vitest';
import { allowedEndpoint } from '../ai-fetch';

describe('allowedEndpoint', () => {
  it('allows the provider APIs and a local server', () => {
    expect(allowedEndpoint('https://api.anthropic.com/v1/models')).toBe(true);
    expect(allowedEndpoint('http://localhost:11434/v1/models')).toBe(true);
  });

  it('refuses anything that is not an http url', () => {
    expect(allowedEndpoint('file:///etc/passwd')).toBe(false);
    expect(allowedEndpoint('mimik-screenshot://abc')).toBe(false);
    expect(allowedEndpoint('not a url')).toBe(false);
  });
});
