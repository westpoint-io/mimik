import {
  ArrowLeft,
  Bug,
  Check,
  ChevronDown,
  ChevronRight,
  EyeOff,
  Globe,
  ImageIcon,
  Mic,
  Shield,
  Sparkles,
  Star,
  Target,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { i18n } from '#imports';
import { PRESET_LABELS, type PresetKey } from '@/core/blur/regexes';
import { isInsecureEndpoint } from '@/core/capture/ai/endpoint';
import { AI_PROVIDERS, type AIProviderKey, CUSTOM_MODEL_VALUE, isCustomModel } from '@/core/capture/ai/models';
import { AI_LANGUAGES, type AILanguageCode } from '@/core/capture/ai/prompts';
import { resolveVoiceApiKey } from '@/core/capture/voice/api-key';
import type { VoiceProvider } from '@/core/capture/voice/transcribe';
import { type BrandLogo, defaultFooterLine, makeBrandLogo } from '@/core/export/branding';
import { DEFAULT_TARGET_COLOR, TARGET_COLORS } from '@/core/screenshot/types';
import { localStorage } from '@/lib/browser-api';
import { logger } from '@/lib/logger';
import { sendMessage } from '@/lib/messaging';
import { Button } from '@/ui/components/ui/button';
import { Input } from '@/ui/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/ui/select';
import ColorPicker from '@/ui/shared/ColorPicker';
import MicrophonePicker from '@/ui/shared/MicrophonePicker';
import { changedSettings, type SettingsSnapshot } from '@/ui/shared/settings-autosave';

interface SettingsViewProps {
  onBack?: () => void;
}

const SAVE_DEBOUNCE_MS = 400;
const SAVED_BADGE_MS = 1600;

type KeyStatus = 'checking' | 'valid' | 'rejected' | 'unreachable' | null;

function useKeyCheck() {
  const [status, setStatus] = useState<KeyStatus>(null);
  const validated = useRef('');

  const check = useCallback(async (provider: string, apiKey: string, baseURL?: string) => {
    const fingerprint = `${provider}:${apiKey}:${baseURL ?? ''}`;
    if (validated.current === fingerprint) {
      setStatus('valid');
      return;
    }
    setStatus('checking');
    const result = await sendMessage('validateApiKey', { provider, apiKey, baseURL }).catch(() => null);
    if (result?.valid) validated.current = fingerprint;
    setStatus(result?.valid ? 'valid' : result?.reason === 'rejected' ? 'rejected' : 'unreachable');
  }, []);

  return { status, setStatus, check };
}

function KeyStatusNote({ status }: { status: KeyStatus }) {
  if (status === 'checking') {
    return <p className="mt-1 text-[11px] text-muted-foreground">{i18n.t('settings.validatingKey')}</p>;
  }
  if (status === 'valid') {
    return (
      <p className="mt-1 text-[11px] flex items-center gap-1" style={{ color: 'var(--color-success)' }}>
        <Check size={11} />
        {i18n.t('settings.keyValid')}
      </p>
    );
  }
  if (status === 'rejected') {
    return (
      <p className="mt-1 text-[11px] text-destructive" role="alert">
        {i18n.t('settings.keyInvalid')}
      </p>
    );
  }
  if (status === 'unreachable') {
    return <p className="mt-1 text-[11px] text-muted-foreground">{i18n.t('settings.keyUnreachable')}</p>;
  }
  return null;
}

const FOOTER_PRESETS = () => [
  defaultFooterLine(),
  i18n.t('settings.footerPresetConfidential'),
  i18n.t('settings.footerPresetNoDistribute'),
];

export default function SettingsView({ onBack }: SettingsViewProps) {
  const [provider, setProvider] = useState<AIProviderKey>('openai');
  const [model, setModel] = useState(AI_PROVIDERS.openai.defaultModel);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [saved, setSaved] = useState(false);
  const aiKeyCheck = useKeyCheck();
  const voiceKeyCheck = useKeyCheck();
  const [customModel, setCustomModel] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const savedSnapshot = useRef<SettingsSnapshot | null>(null);
  const pending = useRef<SettingsSnapshot>({});
  const saveTimer = useRef<number | undefined>(undefined);
  const [aiLanguage, setAiLanguage] = useState<AILanguageCode>('en');
  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider>('openai');
  const [voiceApiKey, setVoiceApiKey] = useState('');
  const [voiceBaseUrl, setVoiceBaseUrl] = useState('');
  const [voiceModel, setVoiceModel] = useState('');
  const [voiceMicrophoneId, setVoiceMicrophoneId] = useState('');
  const [targetColor, setTargetColor] = useState<string>(DEFAULT_TARGET_COLOR);
  const [brandLogo, setBrandLogo] = useState<BrandLogo | null>(null);
  const [brandFooter, setBrandFooter] = useState('');
  const [brandAttribution, setBrandAttribution] = useState(true);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [blurPresets, setBlurPresets] = useState<Record<PresetKey, boolean>>({
    email: true,
    phone: true,
    ssn: false,
    creditCard: false,
    ipAddress: false,
    macAddress: false,
  });

  useEffect(() => {
    localStorage
      .get([
        'aiApiKey',
        'aiBaseUrl',
        'aiProvider',
        'aiModel',
        'aiLanguage',
        'blurPresets',
        'voiceProvider',
        'voiceApiKey',
        'voiceBaseUrl',
        'voiceModel',
        'voiceMicrophoneId',
        'targetColor',
        'brandLogo',
        'brandFooter',
        'brandAttribution',
      ])
      .then((result) => {
        const stored = result.aiProvider as string | undefined;
        const p: AIProviderKey = stored && stored in AI_PROVIDERS ? (stored as AIProviderKey) : 'openai';
        setProvider(p);
        setModel((result.aiModel as string) || AI_PROVIDERS[p].defaultModel);
        if (result.aiApiKey) setApiKey(result.aiApiKey as string);
        if (result.aiBaseUrl) setBaseUrl(result.aiBaseUrl as string);
        if (result.aiLanguage) setAiLanguage(result.aiLanguage as AILanguageCode);
        if (result.blurPresets) setBlurPresets(result.blurPresets as Record<PresetKey, boolean>);
        setVoiceProvider((result.voiceProvider as VoiceProvider) || 'openai');
        if (result.voiceApiKey) setVoiceApiKey(result.voiceApiKey as string);
        if (result.voiceBaseUrl) setVoiceBaseUrl(result.voiceBaseUrl as string);
        if (result.voiceModel) setVoiceModel(result.voiceModel as string);
        if (result.voiceMicrophoneId) setVoiceMicrophoneId(result.voiceMicrophoneId as string);
        if (result.targetColor) setTargetColor(result.targetColor as string);
        if (result.brandLogo) setBrandLogo(result.brandLogo as BrandLogo);
        setBrandFooter(typeof result.brandFooter === 'string' ? result.brandFooter : defaultFooterLine());
        if (result.brandAttribution === false) setBrandAttribution(false);
        setLoaded(true);
      });
  }, []);

  const stored = {
    aiApiKey: apiKey,
    aiBaseUrl: baseUrl,
    aiProvider: provider,
    aiModel: model,
    aiLanguage,
    blurPresets,
    voiceProvider,
    voiceApiKey,
    voiceBaseUrl,
    voiceModel,
    voiceMicrophoneId,
    targetColor,
    brandLogo,
    brandFooter,
    brandAttribution,
  };

  const flush = useCallback(async () => {
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length === 0) return;
    try {
      await localStorage.set(patch);
      setSaved(true);
    } catch (err) {
      logger.error('Settings autosave failed', err);
      setSaved(false);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const snapshot = savedSnapshot.current;
    if (!snapshot) {
      savedSnapshot.current = stored;
      return;
    }

    const patch = changedSettings(stored, snapshot);
    if (!patch) return;

    savedSnapshot.current = stored;
    Object.assign(pending.current, patch);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
  });

  useEffect(
    () => () => {
      window.clearTimeout(saveTimer.current);
      void flush();
    },
    [flush],
  );

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), SAVED_BADGE_MS);
    return () => window.clearTimeout(timer);
  }, [saved]);

  const handleLogoPick = async (file: File | undefined) => {
    if (!file) return;
    setBrandLogo(await makeBrandLogo(file));
  };

  const handleProviderChange = (newProvider: AIProviderKey) => {
    setProvider(newProvider);
    aiKeyCheck.setStatus(null);
    setCustomModel(false);
    setModel(AI_PROVIDERS[newProvider].defaultModel);
    setBaseUrl('');
  };

  const handleModelChange = (value: string) => {
    if (value === CUSTOM_MODEL_VALUE) {
      setCustomModel(true);
      setModel('');
      return;
    }
    setCustomModel(false);
    setModel(value);
  };

  const providerConfig = AI_PROVIDERS[provider];
  const usingCustomModel = customModel || isCustomModel(model, providerConfig);
  const voiceKey = resolveVoiceApiKey({
    voiceProvider,
    voiceApiKey,
    voiceBaseUrl,
    voiceModel,
    aiProvider: provider,
    aiApiKey: apiKey,
  });

  const BLUR_PRESET_I18N: Record<PresetKey, string> = {
    email: 'blurPresets.email',
    phone: 'blurPresets.phoneNumbers',
    ssn: 'blurPresets.ssn',
    creditCard: 'blurPresets.creditCard',
    ipAddress: 'blurPresets.ipAddress',
    macAddress: 'blurPresets.macAddress',
  };

  return (
    <div className="bg-card flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        {onBack && (
          <button
            onClick={onBack}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <h1 className="text-[15px] font-bold text-foreground">{i18n.t('settings.title')}</h1>
        <span
          aria-live="polite"
          className={`ml-auto flex items-center gap-1 text-[11px] font-semibold transition-opacity duration-300 ${
            saved ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ color: 'var(--color-success)' }}
        >
          <Check size={12} />
          {i18n.t('settings.saved')}
        </span>
      </div>

      <div className="flex-1 px-3 py-4 space-y-3">
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
              <SelectTrigger className="w-full rounded-lg px-3 py-2 text-[13px]">
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

          {providerConfig.requiresEndpoint && (
            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1">
                {i18n.t('settings.endpoint')}
              </label>
              <Input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={providerConfig.endpointExample}
                className="h-8 text-[12px] rounded-lg border-border"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">{i18n.t('settings.endpointHint')}</p>
              {isInsecureEndpoint(baseUrl) && (
                <p className="mt-1 text-[11px] text-destructive" role="alert">
                  {i18n.t('settings.endpointInsecure')}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-foreground mb-1">{i18n.t('settings.model')}</label>
            <Select value={usingCustomModel ? CUSTOM_MODEL_VALUE : model} onValueChange={handleModelChange}>
              <SelectTrigger className="w-full rounded-lg px-3 py-2 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providerConfig.models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_MODEL_VALUE}>{i18n.t('settings.modelCustom')}</SelectItem>
              </SelectContent>
            </Select>
            {usingCustomModel && (
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={providerConfig.defaultModel}
                aria-label={i18n.t('settings.modelCustom')}
                className="mt-1.5 h-8 text-[12px] rounded-lg border-border"
              />
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-foreground mb-1">{i18n.t('settings.apiKey')}</label>
            <div className="flex items-center gap-1.5">
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  aiKeyCheck.setStatus(null);
                }}
                placeholder="sk-..."
                className="h-8 text-[12px] rounded-lg border-border"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={
                  !apiKey || (providerConfig.requiresEndpoint && !baseUrl.trim()) || aiKeyCheck.status === 'checking'
                }
                onClick={() => void aiKeyCheck.check(provider, apiKey, baseUrl)}
                className="h-8 shrink-0 rounded-lg bg-card text-[11px] font-semibold"
              >
                {i18n.t('settings.checkKey')}
              </Button>
            </div>
            <KeyStatusNote status={aiKeyCheck.status} />
            {!apiKey.trim() && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[10px] text-destructive leading-relaxed" role="alert">
                <TriangleAlert size={11} className="shrink-0 mt-0.5" />
                <span>{i18n.t('settings.aiNoKey')}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-foreground mb-1">
              <Globe size={11} className="inline mr-1 -mt-px" />
              {i18n.t('settings.aiLanguage')}
            </label>
            <Select value={aiLanguage} onValueChange={(v) => setAiLanguage(v as AILanguageCode)}>
              <SelectTrigger className="w-full rounded-lg px-3 py-2 text-[13px]">
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

        <div className="border border-border rounded-[10px] p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <Target size={14} className="text-accent" />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-foreground">{i18n.t('settings.targetColor')}</div>
              <div className="text-[11px] text-muted-foreground">{i18n.t('settings.targetColorHint')}</div>
            </div>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 shrink-0 border border-border rounded-lg px-2 py-1.5 text-[11px] text-foreground hover:border-accent"
              >
                <span
                  className="w-[22px] h-[22px] rounded-full border border-foreground/15"
                  style={{ backgroundColor: targetColor }}
                />
                <code className="tabular-nums">{targetColor.toUpperCase()}</code>
                <ChevronDown size={12} className="opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2.5">
              <ColorPicker value={targetColor} presets={TARGET_COLORS} onChange={setTargetColor} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="border border-border rounded-[10px] p-3.5 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
              <ImageIcon size={14} className="text-accent" />
            </div>
            <span className="text-xs font-bold text-foreground">{i18n.t('settings.branding')}</span>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-foreground mb-1">
              {i18n.t('settings.brandLogo')}
            </label>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={(e) => handleLogoPick(e.target.files?.[0])}
            />
            <div className="flex items-center gap-2.5">
              {brandLogo && (
                <img
                  src={brandLogo.dataUrl}
                  alt=""
                  className="h-9 max-w-[92px] object-contain rounded border border-border bg-secondary p-1"
                />
              )}
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="border border-border rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:border-accent transition-colors"
              >
                {brandLogo ? i18n.t('settings.replaceLogo') : i18n.t('settings.uploadLogo')}
              </button>
              {brandLogo && (
                <button
                  onClick={() => setBrandLogo(null)}
                  aria-label={i18n.t('settings.removeLogo')}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-foreground mb-1">
              {i18n.t('settings.footerLine')}
            </label>
            <Input
              value={brandFooter}
              onChange={(e) => setBrandFooter(e.target.value)}
              placeholder={i18n.t('settings.footerLinePlaceholder')}
              className="h-8 text-[12px] rounded-lg border-border"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {FOOTER_PRESETS().map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setBrandFooter(preset)}
                  className={`px-2 py-1 rounded-md border text-[10px] transition-colors ${
                    brandFooter === preset
                      ? 'border-accent text-accent'
                      : 'border-border text-muted-foreground hover:border-accent hover:text-foreground'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="text-[11px] font-semibold text-foreground">{i18n.t('settings.attribution')}</div>
            <button
              onClick={() => setBrandAttribution((prev) => !prev)}
              className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${
                brandAttribution ? 'bg-accent' : 'bg-border'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                  brandAttribution ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="border border-border rounded-[10px] p-3.5 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
              <Mic size={14} className="text-accent" />
            </div>
            <span className="text-xs font-bold text-foreground">{i18n.t('settings.voiceNarration')}</span>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-foreground mb-1">
              {i18n.t('settings.provider')}
            </label>
            <select
              value={voiceProvider}
              onChange={(e) => {
                setVoiceProvider(e.target.value as VoiceProvider);
                voiceKeyCheck.setStatus(null);
                setVoiceBaseUrl('');
                setVoiceModel('');
              }}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] text-foreground bg-card font-medium outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
            >
              <option value="openai">OpenAI</option>
              <option value="groq">Groq</option>
              <option value="azure">Azure OpenAI</option>
            </select>
          </div>

          {voiceProvider === 'azure' && (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  {i18n.t('settings.endpoint')}
                </label>
                <Input
                  type="text"
                  value={voiceBaseUrl}
                  onChange={(e) => setVoiceBaseUrl(e.target.value)}
                  placeholder="https://your-resource.openai.azure.com"
                  className="h-8 text-[12px] rounded-lg border-border"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">{i18n.t('settings.endpointHint')}</p>
                {isInsecureEndpoint(voiceBaseUrl) && (
                  <p className="mt-1 text-[11px] text-destructive" role="alert">
                    {i18n.t('settings.endpointInsecure')}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  {i18n.t('settings.voiceDeployment')}
                </label>
                <Input
                  type="text"
                  value={voiceModel}
                  onChange={(e) => setVoiceModel(e.target.value)}
                  className="h-8 text-[12px] rounded-lg border-border"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-foreground mb-1">{i18n.t('settings.apiKey')}</label>
            <div className="flex items-center gap-1.5">
              <Input
                type="password"
                value={voiceApiKey}
                onChange={(e) => {
                  setVoiceApiKey(e.target.value);
                  voiceKeyCheck.setStatus(null);
                }}
                placeholder={voiceProvider === 'groq' ? 'gsk_...' : voiceProvider === 'azure' ? '' : 'sk-...'}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={
                  !voiceApiKey ||
                  (voiceProvider === 'azure' && !voiceBaseUrl.trim()) ||
                  voiceKeyCheck.status === 'checking'
                }
                onClick={() => void voiceKeyCheck.check(voiceProvider, voiceApiKey, voiceBaseUrl)}
                className="h-8 shrink-0 rounded-lg bg-card text-[11px] font-semibold"
              >
                {i18n.t('settings.checkKey')}
              </Button>
            </div>
            <KeyStatusNote status={voiceKeyCheck.status} />
            {voiceKey.source === 'ai' && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[10px] text-muted-foreground leading-relaxed">
                <Sparkles size={11} className="shrink-0 mt-0.5 text-accent" />
                <span>{i18n.t('settings.voiceUsingAiKey')}</span>
              </p>
            )}
            {voiceKey.source === 'none' && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[10px] text-destructive leading-relaxed" role="alert">
                <TriangleAlert size={11} className="shrink-0 mt-0.5" />
                <span>{i18n.t('settings.voiceNoKey')}</span>
              </p>
            )}
          </div>

          {import.meta.env.BROWSER !== 'firefox' && (
            <MicrophonePicker value={voiceMicrophoneId} onChange={setVoiceMicrophoneId} />
          )}
        </div>

        <div className="border border-border rounded-[10px] p-3.5 space-y-1">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
              <EyeOff size={14} className="text-accent" />
            </div>
            <span className="text-xs font-bold text-foreground">{i18n.t('settings.smartBlur')}</span>
          </div>

          {(Object.keys(PRESET_LABELS) as PresetKey[]).map((key, i, arr) => (
            <div
              key={key}
              className={`flex items-center justify-between py-2 ${i < arr.length - 1 ? 'border-b border-secondary' : ''}`}
            >
              <span className="text-xs font-medium text-foreground">{i18n.t(BLUR_PRESET_I18N[key])}</span>
              <button
                onClick={() =>
                  setBlurPresets((prev) => {
                    const next = { ...prev, [key]: !prev[key] };
                    localStorage.set({ blurPresets: next });
                    return next;
                  })
                }
                className={`w-9 h-5 rounded-full transition-colors relative ${
                  blurPresets[key] ? 'bg-accent' : 'bg-border'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                    blurPresets[key] ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-secondary text-[10px] text-muted-foreground leading-relaxed">
          <Shield size={12} className="shrink-0 mt-0.5 text-accent" />
          <span>{i18n.t('settings.privacyNotice')}</span>
        </div>

        <a
          href="https://github.com/westpoint-io/mimik/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-accent transition-colors"
        >
          <Bug size={13} className="shrink-0" />
          <span>{i18n.t('settings.bugReport')}</span>
        </a>

        <div className="flex items-center gap-3.5 border border-border rounded-[10px] p-3.5">
          <svg width="44" height="44" viewBox="20 55 160 108" className="shrink-0">
            <rect x="30" y="95" width="140" height="68" rx="8" fill="#1E1B4B" />
            <path d="M30 95 L30 80 Q30 58, 100 58 Q170 58, 170 80 L170 95 Z" fill="#3730A3" />
            <rect x="30" y="93" width="140" height="3" fill="#C7D2FE" />
            <path d="M68 122 Q76 112 84 122" stroke="#C7D2FE" strokeWidth="5" fill="none" strokeLinecap="round" />
            <path d="M116 122 Q124 112 132 122" stroke="#C7D2FE" strokeWidth="5" fill="none" strokeLinecap="round" />
            <path d="M84 138 Q100 148 116 138" stroke="#C7D2FE" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-foreground mb-0.5">{i18n.t('settings.starCtaTitle')}</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed mb-2">
              {i18n.t('settings.starCtaMessage')}
            </p>
            <a
              href="https://github.com/westpoint-io/mimik"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-[10px] font-semibold text-accent hover:bg-accent hover:text-white transition-colors"
            >
              <Star size={11} fill="#FBBF24" className="text-[#FBBF24]" />
              {i18n.t('settings.starOnGithub')}
              <ChevronRight size={11} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
