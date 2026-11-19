import type { PromptSection } from '@mimik/core/capture/ai/custom-prompts';
import { browser } from '#imports';

export const PROMPTS_REQUEST_KEY = 'aiPromptsRequest';

export async function openPromptsEditor(section: PromptSection) {
  await browser.storage.local.set({ [PROMPTS_REQUEST_KEY]: section });
  await browser.runtime.openOptionsPage();
}
