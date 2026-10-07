import { type AiChoice, KEY_PROVIDER_LABELS, SERVER } from '@mimik/core/capture/ai/keys';
import { AI_PROVIDERS } from '@mimik/core/capture/ai/models';
import { i18n } from '@mimik/core/env';
import type { ProviderOption } from '../components/ProviderSelect';

export function aiProviderOptions(available: (choice: AiChoice) => boolean): ProviderOption<AiChoice>[] {
  return [
    ...(Object.keys(AI_PROVIDERS) as (keyof typeof AI_PROVIDERS)[]).map((key) => ({
      value: key as AiChoice,
      label: KEY_PROVIDER_LABELS[key],
      logo: key,
      available: available(key),
    })),
    {
      value: SERVER as AiChoice,
      label: i18n.t('settings.ownServer'),
      logo: 'server' as const,
      available: available(SERVER),
    },
  ];
}
