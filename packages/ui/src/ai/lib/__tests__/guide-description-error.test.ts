import { describe, expect, it } from 'vitest';
import type { GuideDescriptionError } from '../../../env';
import { guideDescriptionErrorMessage } from '../guide-description-error';

const CASES: [GuideDescriptionError, string][] = [
  ['no-api-key', 'editor.descriptionErrorNoApiKey'],
  ['no-steps', 'editor.descriptionErrorNoSteps'],
  ['generation-failed', 'editor.descriptionErrorFailed'],
  ['save-failed', 'editor.descriptionErrorSaveFailed'],
];

describe('guideDescriptionErrorMessage', () => {
  it.each(CASES)('maps %s to its locale key', (error, key) => {
    expect(guideDescriptionErrorMessage(error)).toBe(key);
  });

  it('gives every error code a distinct message', () => {
    const messages = CASES.map(([error]) => guideDescriptionErrorMessage(error));
    expect(new Set(messages).size).toBe(CASES.length);
  });
});
