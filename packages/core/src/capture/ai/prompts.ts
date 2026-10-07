export const STEP_DESCRIPTION_PROMPT = `You are describing steps in a browser workflow guide. Given the following context about a user action on a web page, write a single concise sentence describing this step.

{{context}}

Examples of good descriptions:
- "Click the Submit button"
- "Enter email address in the Email field"
- "Select 'Admin' from the Role dropdown"
- "Navigate to the Settings page"

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
- "Review claude-code Pull Requests"
- "Configure Slack Notification Preferences"
- "Submit Expense Report in Workday"
- "Create Repository in GitHub Organization"
- "Export a Budget to PDF in Excel"

DESCRIPTION: one or two sentences stating what the workflow accomplishes and who would follow it. Do not repeat the title. Do not list the individual steps. Do not mention any application, website or UI element that does not appear in the steps above.

Examples of good descriptions:
- "Reset a locked-out user's password from the Okta admin panel. For IT support staff."
- "Configure which Slack channels send desktop notifications, and set a do-not-disturb schedule."`;

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
] as const;

export type AILanguageCode = (typeof AI_LANGUAGES)[number]['code'];

const LANGUAGE_NAMES: Record<string, string> = {
  es: 'Spanish',
  fr: 'French',
  pt: 'Brazilian Portuguese',
  de: 'German',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
};

export function getLanguageSuffix(locale: string): string {
  if (locale.startsWith('en')) return '';
  const lang = LANGUAGE_NAMES[locale.split('-')[0]] || locale;
  return `\nIMPORTANT: Write the output in ${lang}.`;
}
