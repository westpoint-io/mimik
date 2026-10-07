import { afterEach, describe, expect, it, vi } from 'vitest';
import { mainFetch } from '../lib/main-fetch';

function stubBridge(fetch: (request: { id: string }) => Promise<unknown>) {
  const abort = vi.fn();
  vi.stubGlobal('window', { mimik: { ai: { fetch: vi.fn(fetch), abort } } });
  return abort;
}

afterEach(() => vi.unstubAllGlobals());

describe('mainFetch', () => {
  it('gives up on a request main never answers once its signal fires, and tells main to drop it', async () => {
    const abort = stubBridge(() => new Promise(() => {}));
    const controller = new AbortController();

    const pending = mainFetch('https://api.openai.com/v1/audio/speech', { method: 'POST', signal: controller.signal });
    controller.abort(new DOMException('timed out', 'TimeoutError'));

    await expect(pending).rejects.toMatchObject({ name: 'TimeoutError' });
    const [{ id }] = (window.mimik.ai.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [{ id: string }];
    expect(abort).toHaveBeenCalledWith(id);
  });

  it('decodes a binary reply back into bytes', async () => {
    stubBridge(async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: btoa('\x01\x02\xff'),
      encoding: 'base64',
    }));

    const response = await mainFetch('https://api.openai.com/v1/audio/speech');

    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2, 255]);
  });

  it('sends a form as bytes with its multipart boundary', async () => {
    stubBridge(async () => ({ status: 200, statusText: 'OK', headers: {}, body: '{}', encoding: 'text' }));
    const form = new FormData();
    form.append('model', 'whisper-1');

    await mainFetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', body: form });

    const [sent] = (window.mimik.ai.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      { body: Uint8Array; headers: Record<string, string> },
    ];
    expect(sent.headers['content-type']).toMatch(/^multipart\/form-data; boundary=/);
    expect(new TextDecoder().decode(sent.body)).toContain('whisper-1');
  });
});
