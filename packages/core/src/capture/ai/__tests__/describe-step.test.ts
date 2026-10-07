import { beforeEach, describe, expect, it, vi } from 'vitest';

let aiForSteps = true;

vi.mock('../read-ai-credentials', () => ({
  readAiCredentials: vi.fn(async () => ({ provider: 'openai', model: 'm', apiKey: 'k' })),
}));
vi.mock('../read-ai-use', () => ({ readAiUse: vi.fn(async () => ({ steps: aiForSteps, guide: true })) }));
vi.mock('../description', () => ({ getAIDescription: vi.fn(async () => 'Type your name in Name') }));

import { describeStep } from '../describe-step';
import { getAIDescription } from '../description';

beforeEach(() => {
  vi.clearAllMocks();
  aiForSteps = true;
});

describe('describeStep', () => {
  it('sends nothing to the provider when AI is off for steps', async () => {
    aiForSteps = false;

    await expect(describeStep('field Name, typed "Ada"')).resolves.toEqual({ text: null, failure: null });
    expect(getAIDescription).not.toHaveBeenCalled();
  });

  it('asks the provider when AI is on for steps', async () => {
    await expect(describeStep('field Name, typed "Ada"')).resolves.toEqual({
      text: 'Type your name in Name',
      failure: null,
    });
    expect(getAIDescription).toHaveBeenCalledOnce();
  });
});
