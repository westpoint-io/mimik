import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APICallError, RetryError } from 'ai';
import { describe, expect, it } from 'vitest';
import { aiActionKey, aiFailureKey } from '@/ui/sidepanel/ai-status';
import { type AiFailureReason, describeAiFailure } from '../errors';

const LOCALES = ['en', 'de', 'es', 'fr', 'pt-BR', 'zh-CN'];
const REASONS: AiFailureReason[] = [
  'rejected',
  'no-credits',
  'rate-limited',
  'model-invalid',
  'quota',
  'network',
  'unknown',
];

function apiError(statusCode: number) {
  return new APICallError({
    message: 'Provider returned error',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    requestBodyValues: {},
    statusCode,
  });
}

describe('describeAiFailure', () => {
  it.each([
    [401, 'rejected'],
    [403, 'rejected'],
    [402, 'no-credits'],
    [429, 'rate-limited'],
    [404, 'model-invalid'],
    [413, 'quota'],
    [500, 'network'],
  ])('reads %i as %s', (status, reason) => {
    expect(describeAiFailure(apiError(status))).toMatchObject({ reason, status });
  });

  it('finds the status inside a retry error, so a rate limit is not read as unknown', () => {
    const retry = new RetryError({
      message: 'Failed after 3 attempts. Last error: Provider returned error',
      reason: 'maxRetriesExceeded',
      errors: [apiError(429), apiError(429), apiError(429)],
    });
    expect(describeAiFailure(retry)).toMatchObject({ reason: 'rate-limited', status: 429 });
  });

  it('reads a bare failure with no status as unknown rather than guessing', () => {
    expect(describeAiFailure(new TypeError('fetch failed'))).toEqual({
      reason: 'unknown',
      message: 'fetch failed',
    });
  });

  it('survives a thrown non-error', () => {
    expect(describeAiFailure('boom')).toEqual({ reason: 'unknown', message: 'boom' });
    expect(describeAiFailure(null)).toEqual({ reason: 'unknown', message: 'null' });
  });
});

describe('failure copy', () => {
  it('gives every reason its own message, in every locale', () => {
    for (const locale of LOCALES) {
      const text = readFileSync(join(process.cwd(), 'src/locales', `${locale}.yml`), 'utf8');
      for (const reason of REASONS) {
        for (const key of [aiFailureKey(reason), aiActionKey(reason)]) {
          const name = key.replace('aiStatus.', '');
          expect(text, `${locale} is missing ${name}`).toContain(`  ${name}:`);
        }
      }
    }
  });

  it('maps an unrecognised reason to the catch-all rather than crashing', () => {
    expect(aiFailureKey(undefined)).toBe('aiStatus.unknown');
    expect(aiActionKey(undefined)).toBe('aiStatus.actionCheckKey');
  });

  it('names the provider in every headline that can', () => {
    const en = readFileSync(join(process.cwd(), 'src/locales/en.yml'), 'utf8');
    for (const reason of ['rejected', 'no-credits', 'rate-limited', 'model-invalid', 'network', 'unknown'] as const) {
      const name = aiFailureKey(reason).replace('aiStatus.', '');
      const line = en.split('\n').find((l) => l.startsWith(`  ${name}:`));
      expect(line, `${name} should interpolate the provider`).toContain('$1');
    }
  });

  it('gives every reason an action to take', () => {
    for (const reason of REASONS) expect(aiActionKey(reason)).toMatch(/^aiStatus\.action/);
  });
});
