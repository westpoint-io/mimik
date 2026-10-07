import { AI_PROVIDERS, type AIProviderKey, CUSTOM_MODEL_VALUE } from '@mimik/core/capture/ai/models';
import { AI_LANGUAGES, type AILanguageCode } from '@mimik/core/capture/ai/prompts';
import { i18n } from '@mimik/core/env';
import { Globe, Sparkles, TriangleAlert } from 'lucide-react';
import { SettingsCard } from '../../common/components/SettingsCard';
import { Switch } from '../../common/components/Switch';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useAiSettings } from '../hooks/use-ai-settings';
import type { KeyStatus, KeyWarning } from '../types';
import { KeyStatusNote } from './KeyStatusNote';
import { KeyWarningNote } from './KeyWarningNote';
import { ModelList } from './ModelList';
import { SecretInput } from './SecretInput';

export interface KeyCheck {
  status: KeyStatus;
  models: string[] | null;
  warning: KeyWarning | null;
  check(provider: string, apiKey: string, baseUrl?: string, model?: string): Promise<void>;
  reset(): void;
}

interface AiSettingsProps {
  keyCheck: KeyCheck;
  onChange?: (patch: Record<string, unknown>) => void;
}

export function AiSettings({ keyCheck: aiKeyCheck, onChange }: AiSettingsProps) {
  const {
    provider,
    model,
    apiKey,
    baseUrl,
    language: aiLanguage,
    ownServer,
    usingCustomModel,
    providerConfig,
    setProvider: handleProviderChange,
    setModel: handleModelChange,
    setApiKey: handleApiKeyChange,
    setBaseUrl: handleBaseUrlChange,
    setLanguage: handleLanguageChange,
    toggleOwnServer: handleOwnServerToggle,
  } = useAiSettings({
    onDirty: (patch) => {
      aiKeyCheck.reset();
      onChange?.(patch);
    },
  });

  return (
    <SettingsCard icon={Sparkles} title={i18n.t('settings.aiDescriptions')}>
      <div>
        <label className="block text-[11px] font-semibold text-foreground mb-1">{i18n.t('settings.provider')}</label>
        <Select value={provider} onValueChange={(v) => handleProviderChange(v as AIProviderKey)}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(AI_PROVIDERS).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>
                {cfg.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-foreground mb-1">{i18n.t('settings.model')}</label>
        <Select value={usingCustomModel ? CUSTOM_MODEL_VALUE : model} onValueChange={handleModelChange}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {providerConfig.models.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {usingCustomModel && (
          <Input
            value={model}
            onChange={(e) => handleModelChange(e.target.value)}
            placeholder={providerConfig.defaultModel}
            aria-label={i18n.t('settings.modelCustom')}
            className="mt-1.5 h-8 text-[13px] rounded-lg border-border"
          />
        )}
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-foreground mb-1">{i18n.t('settings.apiKey')}</label>
        <div className="flex items-center gap-1.5">
          <SecretInput
            value={apiKey}
            onChange={handleApiKeyChange}
            placeholder="sk-..."
            className="h-8 text-[13px] rounded-lg border-border"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!apiKey || aiKeyCheck.status === 'checking'}
            onClick={() => {
              if (aiKeyCheck.status !== 'checking') void aiKeyCheck.check(provider, apiKey, baseUrl, model);
            }}
            className="h-8 shrink-0 rounded-lg bg-card text-[11px] font-semibold"
          >
            {i18n.t('settings.checkKey')}
          </Button>
        </div>
        <KeyStatusNote status={aiKeyCheck.status} />
        <KeyWarningNote warning={aiKeyCheck.warning} />
        {aiKeyCheck.models && <ModelList models={aiKeyCheck.models} />}
        {!apiKey.trim() && (
          <p className="mt-1.5 flex items-start gap-1.5 text-[10px] text-destructive leading-relaxed" role="alert">
            <TriangleAlert size={11} className="shrink-0 mt-0.5" />
            <span>{i18n.t('settings.aiNoKey')}</span>
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 py-0.5">
          <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
            <Globe size={11} className="-mt-px" />
            {i18n.t('settings.useOwnServer')}
          </span>
          <Switch checked={ownServer} label={i18n.t('settings.useOwnServer')} onChange={handleOwnServerToggle} />
        </div>
        {ownServer && (
          <div className="mt-2 space-y-1.5">
            <Input
              type="text"
              value={baseUrl}
              onChange={(e) => handleBaseUrlChange(e.target.value)}
              placeholder={providerConfig.defaultBaseUrl}
              aria-label={i18n.t('settings.baseUrl')}
              className="h-8 text-[13px] rounded-lg border-border"
            />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              {i18n.t(
                providerConfig.protocol === 'anthropic'
                  ? 'settings.ownServerHintAnthropic'
                  : 'settings.ownServerHintOpenai',
              )}
            </p>
          </div>
        )}
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-foreground mb-1">
          <Globe size={11} className="inline mr-1 -mt-px" />
          {i18n.t('settings.aiLanguage')}
        </label>
        <Select value={aiLanguage} onValueChange={(v) => handleLanguageChange(v as AILanguageCode)}>
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
