export const STEP_DESCRIPTION_PROMPT = `You are describing steps in a browser workflow guide. Given the following context about a user action on a web page, write a single concise sentence describing this step.

{{context}}

Examples of good descriptions:
{{examples}}

Copy button labels, field names, and menu items exactly as they appear on the page. Never translate them.

Write only the description, no preamble.`;

export const SCREEN_STEP_DESCRIPTION_PROMPT = `You are describing steps in a guide to a desktop application. Given the following context about one action the user took, write a single concise sentence describing this step.

{{context}}

Name the control by the label it shows, in quotes. Do not use technical control names such as "tree item", "treeview", "pane", "list item" or "group"; say "list", "menu", "field" or "button" only where a reader would. Only mention names that appear above. The previous step is there for context; describe only this one.

Examples of good descriptions:
- "Click "Downloads" in File Explorer"
- "Select "Dark" from the Theme list"
- "Enter "Quarterly report" as the file name"
- "Press Ctrl+S to save the document"

Write only the description, no preamble.`;

export const GUIDE_META_PROMPT = `These are the steps of a recorded workflow. Each one shows where it happened, a page URL or an application and its window, and what the user did:

{{steps}}

Write a title and a description for this workflow.

TITLE: specific and descriptive. Mention the application or website name and the specific task performed. Reference specific pages, features, or items that were interacted with. Only name applications, websites and items that appear in the steps. MUST be under 60 characters.

Examples of good titles:
{{titleExamples}}

DESCRIPTION: one or two sentences stating what the workflow accomplishes and who would follow it. Do not repeat the title. Do not list the individual steps. Do not mention any application, website or UI element that does not appear in the steps above.

Examples of good descriptions:
{{descriptionExamples}}

Copy application names, page names, and UI labels exactly as they appear in the steps. Never translate them.`;

export const GUIDE_META_JSON_SUFFIX = `

Reply with nothing but a JSON object shaped {"title": string, "description": string}. No code fence, no commentary.`;

export const REWRITE_PROMPT = `You are editing one span of text inside a browser workflow guide. The text describes a step a reader must perform, or summarises what the workflow accomplishes.

Selected text:
"""
{{text}}
"""

Instruction: {{instruction}}

Rules:
- Keep it imperative and describing a single action when the original does.
- Never introduce a UI element, button, page, or value that is absent from the original.
- Preserve specific names, labels, and quoted strings exactly as written.
- Match the length the instruction implies; otherwise stay close to the original length.

Return only the rewritten text. No preamble, no quotes, no explanation.`;

export const REWRITE_PRESETS = {
  shorter: 'Make it shorter and tighter without losing any required detail.',
  detail: 'Add detail that clarifies the action, using only information already present.',
  grammar: 'Fix grammar, spelling, and punctuation. Change nothing else.',
  formal: 'Make the tone more formal and professional.',
  casual: 'Make the tone more casual and conversational.',
} as const;

export type RewritePreset = keyof typeof REWRITE_PRESETS;

export const AI_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '中文' },
  { code: 'es', label: 'Español' },
  { code: 'pt-BR', label: 'Português (Brasil)' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ru', label: 'Русский' },
] as const;

export type AILanguageCode = (typeof AI_LANGUAGES)[number]['code'];

import { resolveByLocale } from './locale';

const LANGUAGE_NAMES: Record<string, string> = {
  es: 'Spanish',
  fr: 'French',
  pt: 'Brazilian Portuguese',
  de: 'German',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
};

const LANGUAGE_INSTRUCTIONS: Record<Exclude<AILanguageCode, 'en'>, string> = {
  es: '\nIMPORTANTE: escribe el resultado en español. No traduzcas los nombres de botones, campos ni páginas.',
  fr: '\nIMPORTANT : rédige le résultat en français. Ne traduis pas les noms de boutons, de champs ni de pages.',
  'pt-BR': '\nIMPORTANTE: escreva o resultado em português do Brasil. Não traduza nomes de botões, campos ou páginas.',
  de: '\nWICHTIG: Schreibe die Ausgabe auf Deutsch. Übersetze keine Schaltflächen-, Feld- oder Seitennamen.',
  'zh-CN': '\n重要：请用中文输出。不要翻译按钮、字段和页面的名称。',
  ru: '\nВАЖНО: пиши результат на русском языке. Не переводи названия кнопок, полей и страниц.',
};

export function getLanguageSuffix(locale: string): string {
  const normalized = locale.trim().toLowerCase();
  if (normalized.startsWith('en')) return '';

  const instruction = resolveByLocale(LANGUAGE_INSTRUCTIONS, normalized);
  if (instruction) return instruction;

  const lang = resolveByLocale(LANGUAGE_NAMES, normalized) ?? locale;
  return `\nIMPORTANT: Write the output in ${lang}. Never translate button, field, or page names.`;
}
