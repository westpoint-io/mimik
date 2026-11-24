import type { AI_LANGUAGES } from '@mimik/core/capture/ai/prompts';
import { i18n } from '@mimik/core/env';

export function LanguageLabel({ language }: { language: (typeof AI_LANGUAGES)[number] }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {language.label}
      {'beta' in language && (
        <span className="rounded-full bg-secondary px-1.5 py-px text-[9px] font-semibold uppercase leading-tight text-muted-foreground">
          {i18n.t('settings.languageBeta')}
        </span>
      )}
    </span>
  );
}
