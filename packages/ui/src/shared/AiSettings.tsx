import { AI_LANGUAGES, type AILanguageCode } from '@mimik/core/capture/ai/prompts';
import { type AIApiKeys, keyFor, migrateApiKeys, withKeyFor } from '@mimik/core/capture/ai/keys';
import {
  AI_PROVIDERS,
  type AIProviderKey,
  CUSTOM_MODEL_VALUE,
  DEFAULT_AI_PROVIDER,
  isCustomBaseUrl,
  isCustomModel,
  providerOrDefault,
} from '@mimik/core/capture/ai/models';
import { i18n, localStorage } from '@mimik/core/env';
import { Button } from '@mimik/ui/components/ui/button';
import { Input } from '@mimik/ui/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@mimik/ui/components/ui/select';
import {
  type KeyStatus,
  KeyStatusNote,
  KeyWarningNote,
  type KeyWarning,
  ModelList,
  SecretInput,
} from '@mimik/ui/shared/key-status';
import { Globe, Sparkles, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface KeyCheck {
  status: KeyStatus;
  models: string[] | null;
  warning: KeyWarning | null;
  check(provider: string, apiKey: string, baseUrl?: string, model?: string): Promise<void>;
  reset(): void;
}

interface AiSettingsProps {
  keyCheck: KeyCheck;
  onChange(patch: Record<string, unknown>): void;
}

export default function AiSettings({ keyCheck: aiKeyCheck, onChange }: AiSettingsProps) {
  const [provider, setProvider] = useState<AIProviderKey>(DEFAULT_AI_PROVIDER);
  const [model, setModel] = useState(AI_PROVIDERS[DEFAULT_AI_PROVIDER].defaultModel);
  const [apiKey, setApiKey] = useState('');
  const [apiKeys, setApiKeys] = useState<AIApiKeys>({});
  const [baseUrl, setBaseUrl] = useState('');
  const [customModel, setCustomModel] = useState(false);
  const [ownServer, setOwnServer] = useState(false);
  const [aiLanguage, setAiLanguage] = useState<AILanguageCode>('en');

  useEffect(() => {
    localStorage.get(['aiApiKey', 'aiApiKeys', 'aiProvider', 'aiModel', 'aiBaseUrl', 'aiLanguage']).then((result) => {
      const p = providerOrDefault(result.aiProvider);
      const keys = migrateApiKeys(result);
      setProvider(p);
      setApiKeys(keys);
      setApiKey(keyFor(keys, p));
      setModel((result.aiModel as string) || AI_PROVIDERS[p].defaultModel);
      if (isCustomBaseUrl(AI_PROVIDERS[p], result.aiBaseUrl as string)) {
        setBaseUrl(result.aiBaseUrl as string);
        setOwnServer(true);
      }
      if (result.aiLanguage) setAiLanguage(result.aiLanguage as AILanguageCode);
    });
  }, []);

  const handleProviderChange = (newProvider: AIProviderKey) => {
    setProvider(newProvider);
    setApiKey(keyFor(apiKeys, newProvider));
    aiKeyCheck.reset();
    setCustomModel(false);
    setModel(AI_PROVIDERS[newProvider].defaultModel);
    setOwnServer(false);
    setBaseUrl('');
    onChange({ aiProvider: newProvider, aiModel: AI_PROVIDERS[newProvider].defaultModel, aiBaseUrl: '' });
  };

  const handleOwnServerToggle = () => {
    setOwnServer((on) => {
      if (on) {
        setBaseUrl('');
        onChange({ aiBaseUrl: '' });
      }
      return !on;
    });
    aiKeyCheck.reset();
  };

  const handleModelChange = (value: string) => {
    if (value === CUSTOM_MODEL_VALUE) {
      setCustomModel(true);
      setModel('');
      aiKeyCheck.reset();
      return;
    }
    setCustomModel(false);
    setModel(value);
    aiKeyCheck.reset();
    onChange({ aiModel: value });
  };

  const providerConfig = AI_PROVIDERS[provider] ?? AI_PROVIDERS[DEFAULT_AI_PROVIDER];
  const usingCustomModel = customModel || isCustomModel(model, providerConfig);

  return (
  <div className="border border-border rounded-[10px] p-3.5 space-y-3">
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
        <Sparkles size={14} className="text-accent" />
      </div>
      <span className="text-xs font-bold text-foreground">{i18n.t('settings.aiDescriptions')}</span>
    </div>

    <div>
      <label className="block text-[11px] font-semibold text-foreground mb-1">
        {i18n.t('settings.provider')}
      </label>
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
          onChange={(e) => {
            setModel(e.target.value);
            onChange({ aiModel: e.target.value });
            aiKeyCheck.reset();
          }}
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
          onChange={(next) => {
            setApiKey(next);
            setApiKeys((prev) => {
              const keys = withKeyFor(prev, provider, next);
              onChange({ aiApiKeys: keys, aiApiKey: next });
              return keys;
            });
            aiKeyCheck.reset();
          }}
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
        <button
          type="button"
          role="switch"
          aria-checked={ownServer}
          aria-label={i18n.t('settings.useOwnServer')}
          onClick={handleOwnServerToggle}
          className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${
            ownServer ? 'bg-accent' : 'bg-border'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
              ownServer ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
      {ownServer && (
        <div className="mt-2 space-y-1.5">
          <Input
            type="text"
            value={baseUrl}
            onChange={(e) => {
              setBaseUrl(e.target.value);
              aiKeyCheck.reset();
            }}
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
      <Select value={aiLanguage} onValueChange={(v) => {
          setAiLanguage(v as AILanguageCode);
          onChange({ aiLanguage: v });
        }}>
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
  );
}
