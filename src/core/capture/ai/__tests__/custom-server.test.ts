import { createServer, type Server } from 'node:http';
import { generateText } from 'ai';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createModel } from '../provider';
import { validateApiKey } from '../validate';

interface Seen {
  path: string;
  key?: string;
}

const TEXT = 'Clicked the Update profile button';

function startMockServer(models: string[]): Promise<{ server: Server; seen: Seen[]; url: string }> {
  const seen: Seen[] = [];
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname;
    const auth = req.headers.authorization;
    const key = auth ? auth.replace('Bearer ', '') : (req.headers['x-api-key'] as string | undefined);
    seen.push({ path, key });
    const send = (code: number, body: unknown) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (key === 'bad') return send(401, { error: { message: 'Invalid API key' } });
    if (path.endsWith('/models')) return send(200, { object: 'list', data: models.map((id) => ({ id })) });
    let raw = '';
    req.on('data', (c) => {
      raw += c;
    });
    req.on('end', () => {
      const body = JSON.parse(raw || '{}');
      if (!models.includes(body.model)) return send(404, { error: { message: 'model not found' } });
      if (path.endsWith('/messages')) {
        return send(200, {
          id: 'msg_mock',
          type: 'message',
          role: 'assistant',
          model: body.model,
          content: [{ type: 'text', text: TEXT }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 1, output_tokens: 1 },
        });
      }
      if (path.endsWith('/responses')) {
        return send(200, {
          id: 'resp_mock',
          object: 'response',
          status: 'completed',
          model: body.model,
          output: [
            { type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: TEXT }] },
          ],
          usage: { input_tokens: 1, output_tokens: 1 },
        });
      }
      if (path.endsWith('/chat/completions')) {
        return send(200, {
          id: 'chatcmpl-mock',
          object: 'chat.completion',
          created: 1,
          model: body.model,
          choices: [{ index: 0, message: { role: 'assistant', content: TEXT }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        });
      }
      send(404, { error: { message: 'not found' } });
    });
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ server, seen, url: `http://127.0.0.1:${port}/v1` });
    }),
  );
}

let openai: { server: Server; seen: Seen[]; url: string };
let anthropic: { server: Server; seen: Seen[]; url: string };
let OPENAI_URL: string;
let ANTHROPIC_URL: string;

beforeAll(async () => {
  openai = await startMockServer(['mock-tiny', 'mock-large']);
  anthropic = await startMockServer(['claude-local']);
  OPENAI_URL = openai.url;
  ANTHROPIC_URL = anthropic.url;
});

afterAll(() => {
  openai?.server.close();
  anthropic?.server.close();
});

describe('a real custom server, real fetch, real SDK', () => {
  it('validates an openai-protocol server', async () => {
    expect(await validateApiKey('openai', 'sk-test', OPENAI_URL, 'mock-tiny')).toEqual({
      valid: true,
      models: ['mock-tiny', 'mock-large'],
    });
  });

  it('validates an anthropic-protocol server, using x-api-key against /messages', async () => {
    expect(await validateApiKey('anthropic', 'ak-test', ANTHROPIC_URL, 'claude-local')).toEqual({
      valid: true,
      models: ['claude-local'],
    });
    expect(anthropic.seen.some((r) => r.path === '/v1/messages' && r.key === 'ak-test')).toBe(true);
  });

  it('validates deepseek pointed at the same server', async () => {
    expect(await validateApiKey('deepseek', 'sk-test', OPENAI_URL, 'mock-tiny')).toMatchObject({ valid: true });
  });

  it('reports a bad key as rejected, not as a network error', async () => {
    expect(await validateApiKey('openai', 'bad', OPENAI_URL, 'mock-tiny')).toEqual({
      valid: false,
      reason: 'rejected',
    });
  });

  it('reports an unknown model as model-invalid', async () => {
    expect(await validateApiKey('openai', 'sk-test', OPENAI_URL, 'nope')).toMatchObject({
      valid: false,
      reason: 'model-invalid',
    });
  });

  it('generates against a custom server over chat completions, the endpoint the key check probed', async () => {
    const before = openai.seen.length;
    const { text } = await generateText({
      model: createModel('openai', 'mock-tiny', 'sk-test', OPENAI_URL),
      prompt: 'Describe this step.',
    });
    expect(text).toBe(TEXT);
    expect(openai.seen.slice(before).map((r) => r.path)).toContain('/v1/chat/completions');
  });

  it('generates through the anthropic protocol against a custom server', async () => {
    const { text } = await generateText({
      model: createModel('anthropic', 'claude-local', 'ak-test', ANTHROPIC_URL),
      prompt: 'Describe this step.',
    });
    expect(text).toBe(TEXT);
  });

  it('keeps deepseek on chat completions at its own default endpoint', async () => {
    const before = openai.seen.length;
    await generateText({
      model: createModel('deepseek', 'mock-tiny', 'sk-test', OPENAI_URL),
      prompt: 'Describe this step.',
    });
    expect(openai.seen.slice(before).map((r) => r.path)).toContain('/v1/chat/completions');
  });

  it('leaves the OpenAI default endpoint on the responses API', async () => {
    const before = openai.seen.length;
    const model = createModel('openai', 'mock-tiny', 'sk-test', '');
    expect(model.modelId).toBe('mock-tiny');
    expect(openai.seen.length).toBe(before);
  });
});
