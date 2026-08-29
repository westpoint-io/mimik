import { describe, expect, it } from 'vitest';
import { isInsecureEndpoint, normalizeEndpoint } from '../endpoint';

describe('normalizeEndpoint', () => {
  it('appends the /openai path an Azure resource URL needs to reach the API', () => {
    expect(normalizeEndpoint('azure', 'https://my-res.openai.azure.com')).toBe(
      'https://my-res.openai.azure.com/openai',
    );
  });

  it('does not double up /openai when the user already pasted the full path', () => {
    expect(normalizeEndpoint('azure', 'https://my-res.openai.azure.com/openai')).toBe(
      'https://my-res.openai.azure.com/openai',
    );
  });

  it('forgives a trailing slash rather than producing a double slash', () => {
    expect(normalizeEndpoint('azure', 'https://my-res.openai.azure.com/')).toBe(
      'https://my-res.openai.azure.com/openai',
    );
    expect(normalizeEndpoint('openai', 'https://api.example.com/v1/')).toBe('https://api.example.com/v1');
  });

  it('forgives surrounding whitespace from a copy-paste', () => {
    expect(normalizeEndpoint('openai', '  https://api.example.com/v1  ')).toBe('https://api.example.com/v1');
  });

  it("leaves a non-azure provider's endpoint untouched", () => {
    expect(normalizeEndpoint('openai', 'https://api.groq.com/openai/v1')).toBe('https://api.groq.com/openai/v1');
  });

  it('does not bolt azure path rules onto an unrelated provider endpoint that merely mentions azure', () => {
    expect(normalizeEndpoint('openai', 'https://gateway.internal/azure')).toBe('https://gateway.internal/azure');
  });

  it('returns nothing for a blank endpoint so callers can treat it as unconfigured', () => {
    expect(normalizeEndpoint('azure', '')).toBe('');
    expect(normalizeEndpoint('azure', '   ')).toBe('');
  });

  it('returns nothing for a value that is not a URL at all', () => {
    expect(normalizeEndpoint('azure', 'my-resource')).toBe('');
  });

  it.each([
    'javascript:alert(1)',
    'data:text/plain,hi',
    'file:///etc/passwd',
    'blob:https://x/y',
  ])('refuses %s, so only a fetchable web endpoint can ever be dialled', (scheme) => {
    expect(normalizeEndpoint('openai', scheme)).toBe('');
    expect(normalizeEndpoint('azure', scheme)).toBe('');
  });

  it('still accepts plain http for a non-azure provider', () => {
    expect(normalizeEndpoint('openai', 'http://api.example.com/v1')).toBe('http://api.example.com/v1');
  });
});

describe('isInsecureEndpoint', () => {
  it.each([
    'http://localhost:11434/v1',
    'http://127.0.0.1:1234/v1',
    'http://[::1]:8080/v1',
    'http://10.0.0.5:8000/v1',
    'http://172.16.4.2:8000/v1',
    'http://172.31.255.1:8000/v1',
    'http://192.168.1.50:8000/v1',
  ])('stays quiet about %s, where plain http is normal and the key never leaves the network', (url) => {
    expect(isInsecureEndpoint(url)).toBe(false);
  });

  it.each([
    'http://llm.example.com/v1',
    'http://203.0.113.10:8000/v1',
    'http://172.32.0.1:8000/v1',
    'http://11.0.0.1:8000/v1',
  ])('warns about %s, where the key would cross a network in the clear', (url) => {
    expect(isInsecureEndpoint(url)).toBe(true);
  });

  it.each([
    'https://api.example.com/v1',
    'https://my-res.openai.azure.com',
  ])('stays quiet about encrypted %s', (url) => {
    expect(isInsecureEndpoint(url)).toBe(false);
  });

  it('stays quiet while the field is still empty or half-typed', () => {
    expect(isInsecureEndpoint('')).toBe(false);
    expect(isInsecureEndpoint('http://')).toBe(false);
    expect(isInsecureEndpoint('not-a-url')).toBe(false);
  });
});
