import { PRESET_LABELS, type PresetKey } from '@mimik/core/blur/patterns';
import { i18n } from '@mimik/core/env';
import type { VoiceoverProviderKey } from '@mimik/core/export/voiceover/providers';
import {
  AiSettings,
  ApiKeysSettings,
  BrandingSettings,
  NarrationSettings,
  SettingsCard,
  Switch,
  useApiKeys,
  VoiceoverSettings,
} from '@mimik/ui';
import { ArrowLeft, Bug, Check, ChevronRight, EyeOff, Shield, Star } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { localStorage } from '@/lib/browser-api/local-storage';
import { sendMessage } from '@/lib/messaging';
import { useSettingsAutosave } from '@/ui/shared/hooks/use-settings-autosave';
import { API_KEYS_ID, openApiKeys } from '@/ui/shared/lib/open-api-keys';
import { requestMicrophoneAccess } from '@/ui/shared/lib/request-microphone-access';
import { SETTINGS_SECTIONS, type SettingsSection, settingsSection } from '@/ui/shared/lib/settings-section';
import { validateApiKey } from '@/ui/shared/lib/validate-api-key';

interface SettingsViewProps {
  onBack?: () => void;
  layout?: 'column' | 'sections';
}

export function SettingsView({ onBack, layout = 'column' }: SettingsViewProps) {
  const [section, setSection] = useState<SettingsSection>(() => settingsSection(window.location.hash));
  const [loaded, setLoaded] = useState(false);
  const [blurPresets, setBlurPresets] = useState<Record<PresetKey, boolean>>({
    email: true,
    phone: true,
    ssn: false,
    creditCard: false,
    ipAddress: false,
    macAddress: false,
  });

  useEffect(() => {
    localStorage.get(['blurPresets']).then((result) => {
      if (result.blurPresets) setBlurPresets(result.blurPresets as Record<PresetKey, boolean>);
      setLoaded(true);
    });
  }, []);

  const { saved, queue } = useSettingsAutosave({ blurPresets }, loaded);
  const keys = useApiKeys({ onChange: queue });

  const showSection = (next: SettingsSection) => {
    setSection(next);
    window.history.replaceState(null, '', `#${next}`);
  };
  const openKeys = layout === 'sections' ? () => showSection('api-keys') : openApiKeys;

  const listVoices = useCallback(
    (provider: VoiceoverProviderKey, apiKey: string) =>
      sendMessage('listVoices', { provider, apiKey }).then((result) => result.voices),
    [],
  );

  const BLUR_PRESET_I18N: Record<PresetKey, string> = {
    email: 'blurPresets.email',
    phone: 'blurPresets.phoneNumbers',
    ssn: 'blurPresets.ssn',
    creditCard: 'blurPresets.creditCard',
    ipAddress: 'blurPresets.ipAddress',
    macAddress: 'blurPresets.macAddress',
  };

  const savedBadge = (
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
  );

  const sections: Record<SettingsSection, ReactNode> = {
    ai: <AiSettings keys={keys} onOpenKeys={openKeys} onChange={queue} />,
    narration: (
      <NarrationSettings
        keys={keys}
        onOpenKeys={openKeys}
        onChange={queue}
        onRequestAccess={import.meta.env.BROWSER !== 'firefox' ? requestMicrophoneAccess : undefined}
        liveMeter
      />
    ),
    'voice-over': <VoiceoverSettings keys={keys.keys} listVoices={listVoices} onOpenKeys={openKeys} onChange={queue} />,
    branding: <BrandingSettings onChange={queue} />,
    'smart-blur': (
      <SettingsCard icon={EyeOff} title={i18n.t('settings.smartBlur')} className="space-y-1 [&>*:first-child]:mb-2">
        {(Object.keys(PRESET_LABELS) as PresetKey[]).map((key, i, arr) => (
          <div
            key={key}
            className={`flex items-center justify-between py-2 ${i < arr.length - 1 ? 'border-b border-secondary' : ''}`}
          >
            <span className="text-[11px] font-semibold text-foreground">{i18n.t(BLUR_PRESET_I18N[key])}</span>
            <Switch
              checked={blurPresets[key]}
              label={i18n.t(BLUR_PRESET_I18N[key])}
              onChange={(on) =>
                setBlurPresets((prev) => {
                  const next = { ...prev, [key]: on };
                  localStorage.set({ blurPresets: next });
                  return next;
                })
              }
            />
          </div>
        ))}
      </SettingsCard>
    ),
    'api-keys': <ApiKeysSettings state={keys} validate={validateApiKey} title={i18n.t('settings.apiKeys')} />,
  };

  if (layout === 'sections') {
    const current = SETTINGS_SECTIONS.find((entry) => entry.id === section) ?? SETTINGS_SECTIONS[0];
    return (
      <div className="mx-auto flex w-full max-w-[960px] gap-8 px-8 py-10">
        <nav className="flex w-[220px] shrink-0 flex-col gap-0.5">
          <h1 className="mb-4 ml-3 text-[22px] font-bold text-foreground">{i18n.t('settings.title')}</h1>
          {SETTINGS_SECTIONS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={id === section ? 'page' : undefined}
              onClick={() => showSection(id)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                id === section
                  ? 'bg-card font-semibold text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-card/60 hover:text-foreground'
              }`}
            >
              <Icon size={15} className="shrink-0" />
              {i18n.t(label)}
            </button>
          ))}
        </nav>
        <main className="min-w-0 flex-1 space-y-3">
          <div className="flex h-10 items-center">
            <h2 className="text-base font-bold text-foreground">{i18n.t(current.label)}</h2>
            {savedBadge}
          </div>
          {sections[section]}
        </main>
      </div>
    );
  }

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
        {savedBadge}
      </div>

      <div className="flex-1 px-3 py-4 space-y-3">
        <div id={API_KEYS_ID} className="scroll-mt-3 space-y-3">
          {sections['api-keys']}
        </div>
        {sections.ai}
        {sections.branding}
        {sections.narration}
        {sections['voice-over']}
        {sections['smart-blur']}
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
