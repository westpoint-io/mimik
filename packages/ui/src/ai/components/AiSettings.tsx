import { type AiChoice, KEY_PROVIDER_LABELS, SERVER } from '@mimik/core/capture/ai/keys';
import { AI_PROVIDERS, CUSTOM_MODEL_VALUE } from '@mimik/core/capture/ai/models';
import { AI_LANGUAGES, type AILanguageCode } from '@mimik/core/capture/ai/prompts';
import { i18n } from '@mimik/core/env';
import { Globe, Sparkles } from 'lucide-react';
import { SettingsCard } from '../../common/components/SettingsCard';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useAiSettings } from '../hooks/use-ai-settings';
import type { ApiKeysState } from '../hooks/use-api-keys';
import { MissingKeyNote } from './MissingKeyNote';
import { ProviderSelect } from './ProviderSelect';

interface AiSettingsProps {
  keys: ApiKeysState;
  onOpenKeys?: () => void;
  onChange?: (patch: Record<string, unknown>) => void;
}

export function AiSettings({ keys, onOpenKeys, onChange }: AiSettingsProps) {
  const { provider, model, language, usingCustomModel, models, defaultModel, setProvider, setModel, setLanguage } =
    useAiSettings({ onDirty: onChange });

  const missing =
    provider === SERVER
      ? !keys.server.url.trim() && i18n.t('settings.noServer')
      : !keys.keys[provider] && i18n.t('settings.aiNoKey');

  return (
    <SettingsCard icon={Sparkles} title={i18n.t('settings.aiDescriptions')}>
      <div>
        <label className="block text-[11px] font-semibold text-foreground mb-1">{i18n.t('settings.provider')}</label>
        <ProviderSelect
          value={provider}
          onChange={setProvider}
          onOpenKeys={onOpenKeys}
          options={[
            ...(Object.keys(AI_PROVIDERS) as (keyof typeof AI_PROVIDERS)[]).map((key) => ({
              value: key as AiChoice,
              label: KEY_PROVIDER_LABELS[key],
              logo: key,
              available: Boolean(keys.keys[key]),
            })),
            {
              value: SERVER as AiChoice,
              label: i18n.t('settings.ownServer'),
              logo: 'server' as const,
              available: Boolean(keys.server.url.trim()),
            },
          ]}
        />
        {missing && <MissingKeyNote text={missing} onOpenKeys={onOpenKeys} />}
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-foreground mb-1">{i18n.t('settings.model')}</label>
        {models.length > 0 && (
          <Select value={usingCustomModel ? CUSTOM_MODEL_VALUE : model} onValueChange={setModel}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {usingCustomModel && (
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={defaultModel || 'llama3.2'}
            aria-label={i18n.t('settings.modelCustom')}
            className={`${models.length > 0 ? 'mt-1.5 ' : ''}h-8 text-[13px] rounded-lg border-border`}
          />
        )}
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-foreground mb-1">
          <Globe size={11} className="inline mr-1 -mt-px" />
          {i18n.t('settings.aiLanguage')}
        </label>
        <Select value={language} onValueChange={(v) => setLanguage(v as AILanguageCode)}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AI_LANGUAGES.map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </SettingsCard>
  );
}
