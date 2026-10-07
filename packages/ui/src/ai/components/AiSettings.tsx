import { SERVER } from '@mimik/core/capture/ai/keys';
import { CUSTOM_MODEL_VALUE } from '@mimik/core/capture/ai/models';
import { AI_LANGUAGES, type AILanguageCode } from '@mimik/core/capture/ai/prompts';
import { i18n } from '@mimik/core/env';
import { Sparkles } from 'lucide-react';
import { Checkbox } from '../../common/components/Checkbox';
import { SettingsCard } from '../../common/components/SettingsCard';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useAiSettings } from '../hooks/use-ai-settings';
import type { ApiKeysState } from '../hooks/use-api-keys';
import { aiProviderOptions } from '../lib/ai-provider-options';
import { MissingKeyNote } from './MissingKeyNote';
import { ProviderSelect } from './ProviderSelect';

interface AiSettingsProps {
  keys: ApiKeysState;
  onOpenKeys?: () => void;
  onChange?: (patch: Record<string, unknown>) => void;
}

export function AiSettings({ keys, onOpenKeys, onChange }: AiSettingsProps) {
  const {
    provider,
    model,
    language,
    forSteps,
    forGuide,
    usingCustomModel,
    models,
    defaultModel,
    setProvider,
    setModel,
    setLanguage,
    setForSteps,
    setForGuide,
  } = useAiSettings({ onDirty: onChange });
  const unused = !forSteps && !forGuide;

  const missing =
    provider === SERVER
      ? !keys.server.url.trim() && i18n.t('settings.noServer')
      : !keys.keys[provider] && i18n.t('settings.aiNoKey');

  return (
    <SettingsCard
      icon={Sparkles}
      title={i18n.t('settings.aiDescriptions')}
      hint={i18n.t('settings.aiDescriptionsHint')}
    >
      <div>
        <span className="block text-[11px] font-semibold text-foreground mb-1.5">{i18n.t('settings.aiUseFor')}</span>
        <div className="space-y-2">
          <Checkbox
            checked={forSteps}
            label={i18n.t('settings.aiForSteps')}
            hint={i18n.t('settings.aiForStepsHint')}
            onChange={setForSteps}
          />
          <Checkbox
            checked={forGuide}
            label={i18n.t('settings.aiForGuide')}
            hint={i18n.t('settings.aiForGuideHint')}
            onChange={setForGuide}
          />
        </div>
      </div>

      <div className={`space-y-3 transition-opacity ${unused ? 'opacity-45' : ''}`}>
        <div>
          <label className="block text-[11px] font-semibold text-foreground mb-1">{i18n.t('settings.provider')}</label>
          <ProviderSelect
            value={provider}
            onChange={setProvider}
            onOpenKeys={onOpenKeys}
            options={aiProviderOptions((choice) =>
              choice === SERVER ? Boolean(keys.server.url.trim()) : Boolean(keys.keys[choice]),
            )}
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
      </div>

      {unused && (
        <p className="rounded-lg bg-secondary px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
          {i18n.t('settings.aiUnusedNote')}
        </p>
      )}
    </SettingsCard>
  );
}
