import { keyFor, migrateApiKeys, withKeyFor } from '@mimik/core/capture/ai/keys';
import { AI_PROVIDERS, type AIProviderKey, CUSTOM_MODEL_VALUE, DEFAULT_AI_PROVIDER } from '@mimik/core/capture/ai/models';
import { AI_LANGUAGES } from '@mimik/core/capture/ai/prompts';
import type { KeyValidation } from '@mimik/core/capture/ai/validate';
import { i18n, localStorage } from '@mimik/core/env';
import type { AIApiKeys } from '@mimik/core/capture/ai/keys';
import { Input } from '@mimik/ui/components/ui/input';
import { Check, Eye, EyeOff, Loader2, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';

export type ValidateKey = (provider: string, apiKey: string, baseUrl?: string, model?: string) => Promise<KeyValidation>;

interface AiSettingsProps {
  validate: ValidateKey;
}

const FIELD =
  'w-full h-10 rounded-[10px] border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30';

export default function AiSettings({ validate }: AiSettingsProps) {
  const [provider, setProvider] = useState<AIProviderKey>(DEFAULT_AI_PROVIDER);
  const [keys, setKeys] = useState<AIApiKeys>({});
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [language, setLanguage] = useState('en');
  const [reveal, setReveal] = useState(false);
  const [result, setResult] = useState<KeyValidation | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    localStorage.get(['aiProvider', 'aiApiKeys', 'aiModel', 'aiBaseUrl', 'aiLanguage']).then((stored) => {
      const next = (stored.aiProvider as AIProviderKey) || DEFAULT_AI_PROVIDER;
      setProvider(next);
      setKeys(migrateApiKeys(stored));
      setModel((stored.aiModel as string) || AI_PROVIDERS[next].defaultModel);
      setBaseUrl((stored.aiBaseUrl as string) || '');
      setLanguage((stored.aiLanguage as string) || 'en');
    });
  }, []);

  const apiKey = keyFor(keys, provider);
  const config = AI_PROVIDERS[provider];

  const save = (patch: Record<string, unknown>) => {
    void localStorage.set(patch as never);
  };

  const onProvider = (next: AIProviderKey) => {
    setProvider(next);
    setModel(AI_PROVIDERS[next].defaultModel);
    setResult(null);
    save({ aiProvider: next, aiModel: AI_PROVIDERS[next].defaultModel });
  };

  const onKey = (value: string) => {
    const next = withKeyFor(keys, provider, value);
    setKeys(next);
    setResult(null);
    save({ aiApiKeys: next });
  };

  const check = async () => {
    setChecking(true);
    setResult(await validate(provider, apiKey, baseUrl || undefined, model).catch(() => null));
    setChecking(false);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">{i18n.t('settings_provider')}</span>
          <select className={FIELD} value={provider} onChange={(e) => onProvider(e.target.value as AIProviderKey)}>
            {Object.entries(AI_PROVIDERS).map(([id, p]) => (
              <option key={id} value={id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">{i18n.t('settings_model')}</span>
          <select
            className={FIELD}
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              save({ aiModel: e.target.value });
            }}
          >
            {config.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id === CUSTOM_MODEL_VALUE ? i18n.t('settings_modelCustom') : m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">{i18n.t('settings_apiKey')}</span>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type={reveal ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => onKey(e.target.value)}
              className="h-10 pr-10"
            />
            <button
              type="button"
              aria-label={i18n.t(reveal ? 'settings_hideKey' : 'settings_showKey')}
              onClick={() => setReveal(!reveal)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-accent"
            >
              {reveal ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <button
            type="button"
            onClick={() => void check()}
            disabled={!apiKey || checking}
            className="h-10 rounded-[10px] bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {checking ? <Loader2 size={15} className="animate-spin" /> : i18n.t('settings_checkKey')}
          </button>
        </div>
        {result && <KeyResult result={result} />}
        {!apiKey && <p className="text-xs text-muted-foreground">{i18n.t('settings_aiNoKey')}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">{i18n.t('settings_aiLanguage')}</span>
          <select
            className={FIELD}
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value);
              save({ aiLanguage: e.target.value });
            }}
          >
            {AI_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">{i18n.t('settings_baseUrl')}</span>
          <Input
            value={baseUrl}
            placeholder={config.defaultBaseUrl}
            onChange={(e) => {
              setBaseUrl(e.target.value);
              save({ aiBaseUrl: e.target.value });
            }}
            className="h-10"
          />
        </label>
      </div>
    </div>
  );
}

function KeyResult({ result }: { result: KeyValidation }) {
  if (result.valid) {
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-success">
        <Check size={14} />
        {result.models?.length
          ? i18n.t('settings_modelsFound', [String(result.models.length)])
          : i18n.t('settings_keyValid')}
      </p>
    );
  }
  const unreachable = result.reason === 'network';
  return (
    <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
      <TriangleAlert size={14} />
      {i18n.t(unreachable ? 'settings_keyUnreachable' : 'settings_keyInvalid')}
    </p>
  );
}
