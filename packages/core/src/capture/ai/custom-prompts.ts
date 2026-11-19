import { client } from '@/core/env';
import { formatExamples, resolveExamples } from './examples';
import {
  AI_LANGUAGES,
  GUIDE_META_PROMPT,
  getLanguageSuffix,
  SCREEN_STEP_DESCRIPTION_PROMPT,
  STEP_DESCRIPTION_PROMPT,
} from './prompts';

export type PromptSection = 'steps' | 'guide';

export interface PromptOverride {
  prompt?: string;
  instructions?: string;
}

export type CustomPrompts = Partial<Record<PromptSection, PromptOverride>>;

export const MAX_INSTRUCTIONS_LENGTH = 500;

const DATA_LABEL: Record<PromptSection, string> = {
  steps: 'Step details:',
  guide: 'Steps:',
};

export function exampleBlocks(section: PromptSection, locale: string): string[] {
  const examples = resolveExamples(locale);
  if (section === 'guide') return [formatExamples(examples.titles), formatExamples(examples.descriptions)];
  return [formatExamples(client() === 'desktop' ? examples.screenSteps : examples.steps)];
}

export function defaultPrompt(section: PromptSection, locale: string): string {
  const [first = '', second = ''] = exampleBlocks(section, locale);
  if (section === 'guide') {
    return GUIDE_META_PROMPT.replace('{{titleExamples}}', () => first).replace('{{descriptionExamples}}', () => second);
  }
  const template = client() === 'desktop' ? SCREEN_STEP_DESCRIPTION_PROMPT : STEP_DESCRIPTION_PROMPT;
  return template.replace('{{examples}}', () => first);
}

export function swapExamples(section: PromptSection, text: string, locale: string): string {
  const target = exampleBlocks(section, locale);
  let swapped = text;
  for (const { code } of AI_LANGUAGES) {
    exampleBlocks(section, code).forEach((block, index) => {
      swapped = swapped.replace(block, () => target[index] ?? block);
    });
  }
  return swapped;
}

export function resolvePrompt(section: PromptSection, stored: CustomPrompts | undefined, locale: string): string {
  const saved = stored?.[section]?.prompt;
  if (typeof saved !== 'string' || !saved.trim()) return defaultPrompt(section, locale);
  return swapExamples(section, saved, locale);
}

export function composePrompt(
  section: PromptSection,
  stored: CustomPrompts | undefined,
  locale: string,
  data: string,
): string {
  const parts = [`${DATA_LABEL[section]}\n${data}`, resolvePrompt(section, stored, locale)];
  const instructions = stored?.[section]?.instructions;
  if (typeof instructions === 'string' && instructions.trim()) {
    parts.push(
      `Additional instructions from the user (always follow these):\n${instructions.trim().slice(0, MAX_INSTRUCTIONS_LENGTH)}`,
    );
  }
  return parts.join('\n\n') + getLanguageSuffix(locale);
}
