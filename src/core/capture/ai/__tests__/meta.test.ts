import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateObjectMock, generateTextMock } = vi.hoisted(() => ({
  generateObjectMock: vi.fn(),
  generateTextMock: vi.fn(),
}));

vi.mock('ai', () => ({
  generateObject: generateObjectMock,
  generateText: generateTextMock,
  jsonSchema: (schema: unknown) => schema,
}));

vi.mock('../provider', () => ({ createModel: () => ({ id: 'test-model' }) }));

vi.mock('@/lib/browser-api', () => ({
  localStorage: { get: vi.fn().mockResolvedValue({ aiLanguage: 'en' }) },
}));

import { generateGuideMeta, parseGuideMeta } from '../meta';

const steps = [{ description: 'Click Directory', url: 'https://admin.okta.com/users' }];

const UNSUPPORTED = new Error('response_format json_schema is not supported by this model');

describe('generateGuideMeta', () => {
  beforeEach(() => {
    generateObjectMock.mockReset();
    generateTextMock.mockReset();
  });

  it('returns both title and description from a well-formed response', async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        title: 'Reset a User Password in Okta',
        description: 'Reset a locked-out user password.',
      },
    });

    const result = await generateGuideMeta(steps, { provider: 'openai', model: 'gpt-4o-mini', apiKey: 'key' });

    expect(result).toEqual({
      title: 'Reset a User Password in Okta',
      description: 'Reset a locked-out user password.',
    });
  });

  it('still yields a usable title when the model omits the description', async () => {
    generateObjectMock.mockResolvedValue({ object: { title: 'Reset a User Password in Okta' } });

    const result = await generateGuideMeta(steps, { provider: 'openai', model: 'gpt-4o-mini', apiKey: 'key' });

    expect(result?.title).toBe('Reset a User Password in Okta');
    expect(result?.description).toBeUndefined();
  });

  it('truncates a title over 70 characters', async () => {
    generateObjectMock.mockResolvedValue({ object: { title: 'x'.repeat(90), description: 'ok' } });

    const result = await generateGuideMeta(steps, { provider: 'openai', model: 'gpt-4o-mini', apiKey: 'key' });

    expect(result?.title.length).toBe(70);
    expect(result?.title.endsWith('...')).toBe(true);
  });

  it('marks every declared property as required, as strict mode demands', async () => {
    generateObjectMock.mockResolvedValue({ object: { title: 'T', description: null } });

    await generateGuideMeta(steps, { provider: 'openai', model: 'gpt-4o-mini', apiKey: 'key' });

    const { schema } = generateObjectMock.mock.calls[0][0];
    expect(schema.required.sort()).toEqual(Object.keys(schema.properties).sort());
  });

  it('treats a null description from the model as absent', async () => {
    generateObjectMock.mockResolvedValue({ object: { title: 'Okta Password Reset', description: null } });

    const result = await generateGuideMeta(steps, { provider: 'openai', model: 'gpt-4o-mini', apiKey: 'key' });

    expect(result?.title).toBe('Okta Password Reset');
    expect(result?.description).toBeUndefined();
  });

  it('returns null when the model returns a blank title', async () => {
    generateObjectMock.mockResolvedValue({ object: { title: '   ', description: 'ok' } });

    expect(await generateGuideMeta(steps, { provider: 'openai', model: 'gpt-4o-mini', apiKey: 'key' })).toBeNull();
  });

  it('interpolates the numbered steps into the prompt', async () => {
    generateObjectMock.mockResolvedValue({ object: { title: 'Okta Password Reset' } });

    await generateGuideMeta(steps, { provider: 'openai', model: 'gpt-4o-mini', apiKey: 'key' });

    const { prompt } = generateObjectMock.mock.calls[0][0];
    expect(prompt).toContain('1. [https://admin.okta.com/users] Click Directory');
    expect(prompt).not.toContain('{{steps}}');
  });

  it('returns null for an empty step list without calling the model', async () => {
    expect(await generateGuideMeta([], { provider: 'openai', model: 'gpt-4o-mini', apiKey: 'key' })).toBeNull();
    expect(generateObjectMock).not.toHaveBeenCalled();
  });

  it('returns null when both the structured call and the text retry throw', async () => {
    generateObjectMock.mockRejectedValue(new Error('rate limited'));
    generateTextMock.mockRejectedValue(new Error('rate limited'));
    expect(await generateGuideMeta(steps, { provider: 'openai', model: 'gpt-4o-mini', apiKey: 'key' })).toBeNull();
  });
});

describe('models without structured output support', () => {
  beforeEach(() => {
    generateObjectMock.mockReset();
    generateTextMock.mockReset();
    generateObjectMock.mockRejectedValue(UNSUPPORTED);
  });

  it('falls back to a plain text call and still yields a title', async () => {
    generateTextMock.mockResolvedValue({
      text: '{"title": "Check Recent Deaths on Wikipedia", "description": "Look up an entry."}',
    });

    const result = await generateGuideMeta(steps, { provider: 'openai', model: 'gpt-3.5-turbo', apiKey: 'key' });

    expect(result).toEqual({
      title: 'Check Recent Deaths on Wikipedia',
      description: 'Look up an entry.',
    });
  });

  it('asks the fallback call for bare JSON', async () => {
    generateTextMock.mockResolvedValue({ text: '{"title": "T"}' });

    await generateGuideMeta(steps, { provider: 'openai', model: 'gpt-3.5-turbo', apiKey: 'key' });

    const { prompt } = generateTextMock.mock.calls[0][0];
    expect(prompt).toContain('1. [https://admin.okta.com/users] Click Directory');
    expect(prompt).toContain('"title"');
  });

  it('does not spend a second call when the structured call succeeds', async () => {
    generateObjectMock.mockReset();
    generateObjectMock.mockResolvedValue({ object: { title: 'T', description: 'D' } });

    await generateGuideMeta(steps, { provider: 'openai', model: 'gpt-4o-mini', apiKey: 'key' });

    expect(generateTextMock).not.toHaveBeenCalled();
  });
});

describe('parseGuideMeta', () => {
  it('reads a bare JSON object', () => {
    expect(parseGuideMeta('{"title": "Okta Reset", "description": "Reset it."}')).toEqual({
      title: 'Okta Reset',
      description: 'Reset it.',
    });
  });

  it('unwraps a fenced code block the model added anyway', () => {
    expect(parseGuideMeta('```json\n{"title": "Okta Reset"}\n```')).toEqual({
      title: 'Okta Reset',
      description: undefined,
    });
  });

  it('ignores prose wrapped around the object', () => {
    expect(parseGuideMeta('Sure! Here you go:\n{"title": "Okta Reset"}\nHope that helps.')?.title).toBe('Okta Reset');
  });

  it('takes a bare line as the title when the model ignored the JSON request', () => {
    expect(parseGuideMeta('Reset a User Password in Okta')?.title).toBe('Reset a User Password in Okta');
  });

  it('refuses a bare line that is really a lead-in to broken JSON', () => {
    expect(parseGuideMeta('Here is the JSON: {"title": ')).toBeNull();
  });

  it('refuses a bare line too long to be a title', () => {
    expect(parseGuideMeta('x'.repeat(120))).toBeNull();
  });

  it('truncates an over-long title from the fallback path too', () => {
    const result = parseGuideMeta(JSON.stringify({ title: 'x'.repeat(90) }));
    expect(result?.title.length).toBe(70);
    expect(result?.title.endsWith('...')).toBe(true);
  });

  it('returns null for an empty response', () => {
    expect(parseGuideMeta('   ')).toBeNull();
  });
});
