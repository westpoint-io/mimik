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
  Pencil,
  Plus,
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
import {
  AI_PROVIDERS,
  type AIProfile,
  CUSTOM_MODEL_VALUE,
  isCustomModel,
  isProfileProvider,
  makeProfileId,
  PROFILE_PREFIX,
  profileProviderId,
} from '@/core/capture/ai/models';
import { AI_LANGUAGES, type AILanguageCode } from '@/core/capture/ai/prompts';
import { resolveVoiceApiKey } from '@/core/capture/voice/api-key';
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

  const check = useCallback(async (provider: string, apiKey: string, baseUrl?: string) => {
    const fingerprint = `${provider}:${apiKey}:${baseUrl ?? ''}`;
    if (validated.current === fingerprint) {
      setStatus('valid');
      return;
    }
    setStatus('checking');
    const result = await sendMessage('validateApiKey', { provider, apiKey, baseUrl }).catch(() => null);
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

const ADD_PROFILE_VALUE = '__add_profile__';

export default function SettingsView({ onBack }: SettingsViewProps) {
  const [provider, setProvider] = useState<string>('openai');
  const [model, setModel] = useState(AI_PROVIDERS.openai.defaultModel);
  const [apiKey, setApiKey] = useState('');
  const [aiBaseUrl, setAiBaseUrl] = useState('');
  const [aiProfiles, setAiProfiles] = useState<AIProfile[]>([]);
  const [editingProfile, setEditingProfile] = useState<AIProfile | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProfile, setNewProfile] = useState({ name: '', baseUrl: '', apiKey: '', model: '' });
  const [saved, setSaved] = useState(false);
  const aiKeyCheck = useKeyCheck();
  const voiceKeyCheck = useKeyCheck();
  const [customModel, setCustomModel] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const savedSnapshot = useRef<SettingsSnapshot | null>(null);
  const pending = useRef<SettingsSnapshot>({});
  const saveTimer = useRef<number | undefined>(undefined);
  const [aiLanguage, setAiLanguage] = useState<AILanguageCode>('en');
  const [voiceProvider, setVoiceProvider] = useState<string>('openai');
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
        'aiProvider',
        'aiModel',
        'aiBaseUrl',
        'aiEndpoint',
        'aiProfiles',
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
        if (Array.isArray(result.aiProfiles)) setAiProfiles(result.aiProfiles as AIProfile[]);
        const p = (result.aiProvider as string) || 'openai';
        // if legacy profile not in list, fallback to openai
        if (isProfileProvider(p) && Array.isArray(result.aiProfiles)) {
          const exists = (result.aiProfiles as AIProfile[]).some((pr) => profileProviderId(pr.id) === p);
          setProvider(exists ? p : 'openai');
        } else {
          setProvider(p in AI_PROVIDERS ? p : 'openai');
        }
        // model/key/baseUrl handling
        if (isProfileProvider(p) && Array.isArray(result.aiProfiles)) {
          const prof = (result.aiProfiles as AIProfile[]).find((pr) => profileProviderId(pr.id) === p);
          if (prof) {
            setModel(prof.model || '');
          } else {
            setModel((result.aiModel as string) || AI_PROVIDERS.openai.defaultModel);
          }
        } else {
          setModel(
            (result.aiModel as string) ||
              AI_PROVIDERS[p as keyof typeof AI_PROVIDERS]?.defaultModel ||
              AI_PROVIDERS.openai.defaultModel,
          );
        }
        if (result.aiApiKey) setApiKey(result.aiApiKey as string);
        const base = (result.aiBaseUrl as string) || (result.aiEndpoint as string) || '';
        if (base) setAiBaseUrl(base);
        if (result.aiLanguage) setAiLanguage(result.aiLanguage as AILanguageCode);
        if (result.blurPresets) setBlurPresets(result.blurPresets as Record<PresetKey, boolean>);
        setVoiceProvider((result.voiceProvider as string) || 'openai');
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

  const isProfile = isProfileProvider(provider);
  const activeProfile = isProfile ? aiProfiles.find((pr) => profileProviderId(pr.id) === provider) : null;

  const stored = {
    aiApiKey: isProfile ? (activeProfile?.apiKey ?? '') : apiKey,
    aiProvider: provider,
    aiModel: isProfile ? (activeProfile?.model ?? '') : model,
    aiBaseUrl: isProfile ? '' : aiBaseUrl,
    aiProfiles,
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

  const handleProviderChange = (newProvider: string) => {
    if (newProvider === ADD_PROFILE_VALUE) {
      setShowAddForm(true);
      return;
    }
    setProvider(newProvider);
    aiKeyCheck.setStatus(null);
    if (newProvider in AI_PROVIDERS) {
      setCustomModel(false);
      setModel(AI_PROVIDERS[newProvider as keyof typeof AI_PROVIDERS].defaultModel);
    }
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

  const updateProfileField = (id: string, patch: Partial<AIProfile>) => {
    setAiProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const handleAddProfile = () => {
    if (!newProfile.baseUrl.trim() || !newProfile.model.trim()) return;
    const id = makeProfileId();
    const profile: AIProfile = {
      id,
      name: newProfile.name.trim() || `Custom ${aiProfiles.length + 1}`,
      baseUrl: newProfile.baseUrl.trim(),
      apiKey: newProfile.apiKey.trim(),
      model: newProfile.model.trim(),
    };
    const next = [...aiProfiles, profile];
    setAiProfiles(next);
    setProvider(profileProviderId(id));
    setNewProfile({ name: '', baseUrl: '', apiKey: '', model: '' });
    setShowAddForm(false);
  };

  const handleDeleteProfile = (id: string) => {
    const next = aiProfiles.filter((p) => p.id !== id);
    setAiProfiles(next);
    if (provider === profileProviderId(id)) {
      setProvider('openai');
      setModel(AI_PROVIDERS.openai.defaultModel);
    }
    if (editingProfile?.id === id) setEditingProfile(null);
  };

  const isOpenAIProvider = provider === 'openai';
  const providerConfig =
    !isProfile && AI_PROVIDERS[provider as keyof typeof AI_PROVIDERS]
      ? AI_PROVIDERS[provider as keyof typeof AI_PROVIDERS]
      : null;
  const usingCustomModel = providerConfig ? customModel || isCustomModel(model, providerConfig) : false;
  const voiceKey = resolveVoiceApiKey({
    voiceProvider,
    voiceApiKey,
    voiceBaseUrl,
    voiceModel,
    aiProvider: provider,
    aiApiKey: isProfile ? (activeProfile?.apiKey ?? '') : apiKey,
    aiProfiles,
    aiBaseUrl,
  });

  const BLUR_PRESET_I18N: Record<PresetKey, string> = {
    email: 'blurPresets.email',
    phone: 'blurPresets.phoneNumbers',
    ssn: 'blurPresets.ssn',
    creditCard: 'blurPresets.creditCard',
    ipAddress: 'blurPresets.ipAddress',
    macAddress: 'blurPresets.macAddress',
  };

  const aiBaseUrlForCheck = isProfile ? activeProfile?.baseUrl : aiBaseUrl;
  const aiApiKeyForCheck = isProfile ? (activeProfile?.apiKey ?? '') : apiKey;
  const canCheckAiKey = (() => {
    if (isProfile) return Boolean(activeProfile?.baseUrl.trim() && activeProfile?.model.trim());
    if (aiBaseUrl.trim()) return true; // allow keyless check with baseUrl
    return Boolean(apiKey.trim());
  })();

  const voiceProviderIsProfile = typeof voiceProvider === 'string' && voiceProvider.startsWith(PROFILE_PREFIX);
  const canCheckVoiceKey = (() => {
    if (voiceProviderIsProfile) return true;
    if (voiceBaseUrl.trim()) return true;
    return Boolean(voiceApiKey.trim());
  })();

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
            <Select value={provider} onValueChange={handleProviderChange}>
              <SelectTrigger className="w-full rounded-lg px-3 py-2 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AI_PROVIDERS).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    {cfg.label}
                  </SelectItem>
                ))}
                {aiProfiles.map((pr) => (
                  <SelectItem key={pr.id} value={profileProviderId(pr.id)}>
                    {pr.name} — {pr.model}
                  </SelectItem>
                ))}
                <SelectItem value={ADD_PROFILE_VALUE}>+ {i18n.t('settings.addProfile')}</SelectItem>
              </SelectContent>
            </Select>
            {aiProfiles.length > 0 && !isProfile && (
              <p className="mt-1 text-[10px] text-muted-foreground">{i18n.t('settings.profilesHint')}</p>
            )}
          </div>

          {isProfile && activeProfile ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-foreground mb-1">
                    {i18n.t('settings.profileName')}
                  </label>
                  <Input
                    value={activeProfile.name}
                    onChange={(e) => updateProfileField(activeProfile.id, { name: e.target.value })}
                    placeholder="Local Ollama"
                    className="h-8 text-[12px] rounded-lg border-border"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-foreground mb-1">
                    {i18n.t('settings.model')}
                  </label>
                  <Input
                    value={activeProfile.model}
                    onChange={(e) => updateProfileField(activeProfile.id, { model: e.target.value })}
                    placeholder="gpt-4o-mini"
                    className="h-8 text-[12px] rounded-lg border-border"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  {i18n.t('settings.baseUrl')}
                </label>
                <Input
                  value={activeProfile.baseUrl}
                  onChange={(e) => updateProfileField(activeProfile.id, { baseUrl: e.target.value })}
                  placeholder="https://api.example.com/v1"
                  className="h-8 text-[12px] rounded-lg border-border"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">{i18n.t('settings.baseUrlHint')}</p>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  {i18n.t('settings.apiKey')}
                </label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="password"
                    value={activeProfile.apiKey}
                    onChange={(e) => updateProfileField(activeProfile.id, { apiKey: e.target.value })}
                    placeholder="sk-... (leave empty for local)"
                    className="h-8 text-[12px] rounded-lg border-border"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canCheckAiKey || aiKeyCheck.status === 'checking'}
                    onClick={() => void aiKeyCheck.check(provider, aiApiKeyForCheck, aiBaseUrlForCheck)}
                    className="h-8 shrink-0 rounded-lg bg-card text-[11px] font-semibold"
                  >
                    {i18n.t('settings.checkKey')}
                  </Button>
                </div>
                <KeyStatusNote status={aiKeyCheck.status} />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteProfile(activeProfile.id)}
                  className="h-7 text-[11px]"
                >
                  <Trash2 size={11} className="mr-1" /> {i18n.t('settings.deleteProfile')}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  {i18n.t('settings.model')}
                </label>
                <Select value={usingCustomModel ? CUSTOM_MODEL_VALUE : model} onValueChange={handleModelChange}>
                  <SelectTrigger className="w-full rounded-lg px-3 py-2 text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {providerConfig?.models.map((m) => (
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
                    placeholder={providerConfig?.defaultModel}
                    aria-label={i18n.t('settings.modelCustom')}
                    className="mt-1.5 h-8 text-[12px] rounded-lg border-border"
                  />
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  {i18n.t('settings.apiKey')}
                </label>
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
                    disabled={!canCheckAiKey || aiKeyCheck.status === 'checking'}
                    onClick={() => void aiKeyCheck.check(provider, apiKey, aiBaseUrl)}
                    className="h-8 shrink-0 rounded-lg bg-card text-[11px] font-semibold"
                  >
                    {i18n.t('settings.checkKey')}
                  </Button>
                </div>
                <KeyStatusNote status={aiKeyCheck.status} />
                {!apiKey.trim() && !aiBaseUrl.trim() && (
                  <p
                    className="mt-1.5 flex items-start gap-1.5 text-[10px] text-destructive leading-relaxed"
                    role="alert"
                  >
                    <TriangleAlert size={11} className="shrink-0 mt-0.5" />
                    <span>{i18n.t('settings.aiNoKey')}</span>
                  </p>
                )}
              </div>

              {(isOpenAIProvider || provider === 'groq') && (
                <div>
                  <label className="block text-[11px] font-semibold text-foreground mb-1">
                    {i18n.t('settings.baseUrl')}{' '}
                    <span className="font-normal text-muted-foreground">({i18n.t('settings.baseUrlOptional')})</span>
                  </label>
                  <Input
                    value={aiBaseUrl}
                    onChange={(e) => {
                      setAiBaseUrl(e.target.value);
                      aiKeyCheck.setStatus(null);
                    }}
                    placeholder="https://api.example.com/v1"
                    className="h-8 text-[12px] rounded-lg border-border"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">{i18n.t('settings.baseUrlHint')}</p>
                </div>
              )}
            </>
          )}

          {showAddForm && (
            <div className="border border-accent rounded-lg p-3 space-y-2 bg-secondary/30">
              <p className="text-[11px] font-semibold text-foreground">{i18n.t('settings.addProfile')}</p>
              <Input
                value={newProfile.name}
                onChange={(e) => setNewProfile((p) => ({ ...p, name: e.target.value }))}
                placeholder={i18n.t('settings.profileName')}
                className="h-8 text-[12px]"
              />
              <Input
                value={newProfile.baseUrl}
                onChange={(e) => setNewProfile((p) => ({ ...p, baseUrl: e.target.value }))}
                placeholder="https://api.example.com/v1"
                className="h-8 text-[12px]"
              />
              <Input
                value={newProfile.model}
                onChange={(e) => setNewProfile((p) => ({ ...p, model: e.target.value }))}
                placeholder="gpt-4o-mini"
                className="h-8 text-[12px]"
              />
              <Input
                type="password"
                value={newProfile.apiKey}
                onChange={(e) => setNewProfile((p) => ({ ...p, apiKey: e.target.value }))}
                placeholder="sk-... (empty for local)"
                className="h-8 text-[12px]"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleAddProfile}
                  disabled={!newProfile.baseUrl.trim() || !newProfile.model.trim()}
                  className="h-7 text-[11px]"
                >
                  {i18n.t('common.save')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)} className="h-7 text-[11px]">
                  {i18n.t('common.cancel')}
                </Button>
              </div>
            </div>
          )}

          {aiProfiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {aiProfiles.map((pr) => (
                <span
                  key={pr.id}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] ${provider === profileProviderId(pr.id) ? 'border-accent text-accent' : 'border-border text-muted-foreground'}`}
                >
                  {pr.name}
                  <button onClick={() => setProvider(profileProviderId(pr.id))} className="hover:text-accent">
                    <Pencil size={10} />
                  </button>
                  <button onClick={() => handleDeleteProfile(pr.id)} className="hover:text-destructive">
                    <Trash2 size={10} />
                  </button>
                </span>
              ))}
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-dashed border-border text-[10px] text-muted-foreground hover:border-accent hover:text-accent"
                >
                  <Plus size={10} /> {i18n.t('settings.addProfile')}
                </button>
              )}
            </div>
          )}

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
                setVoiceProvider(e.target.value);
                voiceKeyCheck.setStatus(null);
              }}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] text-foreground bg-card font-medium outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
            >
              <option value="openai">OpenAI</option>
              <option value="groq">Groq</option>
              {aiProfiles.map((pr) => (
                <option key={pr.id} value={profileProviderId(pr.id)}>
                  {pr.name} (Custom)
                </option>
              ))}
            </select>
          </div>

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
                placeholder={voiceProvider === 'groq' ? 'gsk_...' : 'sk-...'}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={!canCheckVoiceKey || voiceKeyCheck.status === 'checking'}
                onClick={() =>
                  void voiceKeyCheck.check(
                    voiceProvider,
                    voiceApiKey,
                    voiceProviderIsProfile
                      ? aiProfiles.find((p) => profileProviderId(p.id) === voiceProvider)?.baseUrl
                      : voiceBaseUrl,
                  )
                }
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

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1">
                {i18n.t('settings.baseUrl')}{' '}
                <span className="font-normal text-muted-foreground">({i18n.t('settings.baseUrlOptional')})</span>
              </label>
              <Input
                value={voiceBaseUrl}
                onChange={(e) => {
                  setVoiceBaseUrl(e.target.value);
                  voiceKeyCheck.setStatus(null);
                }}
                placeholder="https://api.example.com/v1"
                className="h-8 text-[12px] rounded-lg border-border"
                disabled={voiceProviderIsProfile}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1">
                {i18n.t('settings.model')}{' '}
                <span className="font-normal text-muted-foreground">({i18n.t('settings.baseUrlOptional')})</span>
              </label>
              <Input
                value={voiceModel}
                onChange={(e) => setVoiceModel(e.target.value)}
                placeholder="whisper-1"
                className="h-8 text-[12px] rounded-lg border-border"
                disabled={voiceProviderIsProfile}
              />
            </div>
          </div>
          {voiceProviderIsProfile && (
            <p className="text-[10px] text-muted-foreground">{i18n.t('settings.voiceProfileHint')}</p>
          )}

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
