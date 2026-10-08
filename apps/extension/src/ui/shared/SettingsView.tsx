import { PRESET_LABELS, type PresetKey } from '@mimik/core/blur/patterns';
import { i18n } from '@mimik/core/env';
import type { VoiceoverProviderKey } from '@mimik/core/export/voiceover/providers';
import {
  AiSettings,
  ApiKeysSettings,
  BrandingSettings,
  NarrationSettings,
  SavedBadge,
  SettingsCard,
  Switch,
  useApiKeys,
  VoiceoverSettings,
} from '@mimik/ui';
import { ArrowLeft, EyeOff, Keyboard } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { localStorage } from '@/lib/browser-api/local-storage';
import { sendMessage } from '@/lib/messaging';
import { useSettingsAutosave } from '@/ui/shared/hooks/use-settings-autosave';
import { API_KEYS_ID, openApiKeys } from '@/ui/shared/lib/open-api-keys';
import { requestMicrophoneAccess } from '@/ui/shared/lib/request-microphone-access';
import { SETTINGS_SECTIONS, type SettingsSection, settingsSection } from '@/ui/shared/lib/settings-section';
import { validateApiKey } from '@/ui/shared/lib/validate-api-key';
import { SettingsFooter } from '@/ui/shared/SettingsFooter';

interface SettingsViewProps {
  onBack?: () => void;
  layout?: 'column' | 'sections';
}

export function SettingsView({ onBack, layout = 'column' }: SettingsViewProps) {
  const [section, setSection] = useState<SettingsSection>(() => settingsSection(window.location.hash));
  const [loaded, setLoaded] = useState(false);
  const [recordKeys, setRecordKeys] = useState(false);
  const [recordTyping, setRecordTyping] = useState(true);
  const [blurPresets, setBlurPresets] = useState<Record<PresetKey, boolean>>({
    email: true,
    phone: true,
    ssn: false,
    creditCard: false,
    ipAddress: false,
    macAddress: false,
  });

  useEffect(() => {
    localStorage.get(['blurPresets', 'recordKeys', 'recordTyping']).then((result) => {
      if (result.blurPresets) setBlurPresets(result.blurPresets as Record<PresetKey, boolean>);
      setRecordKeys(result.recordKeys === true);
      setRecordTyping(result.recordTyping !== false);
      setLoaded(true);
    });
  }, []);

  const { saved, queue } = useSettingsAutosave({ blurPresets, recordKeys, recordTyping }, loaded);
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

  const savedBadge = <SavedBadge saved={saved} />;

  const sections: Record<SettingsSection, ReactNode> = {
    ai: (
      <>
        <AiSettings keys={keys} onOpenKeys={openKeys} onChange={queue} />
        <NarrationSettings
          keys={keys}
          onOpenKeys={openKeys}
          onChange={queue}
          onRequestAccess={import.meta.env.BROWSER !== 'firefox' ? requestMicrophoneAccess : undefined}
          liveMeter
        />
        <VoiceoverSettings keys={keys.keys} listVoices={listVoices} onOpenKeys={openKeys} onChange={queue} />
      </>
    ),
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
    keyboard: (
      <SettingsCard icon={Keyboard} title={i18n.t('settings.cardKeyboard')} hint={i18n.t('settings.cardKeyboardHint')}>
        <div className="flex items-center justify-between gap-3 py-2 border-b border-secondary">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-foreground">{i18n.t('settings.recordTyping')}</p>
            <p className="text-[11px] text-muted-foreground">{i18n.t('settings.recordTypingHint')}</p>
          </div>
          <Switch
            checked={recordTyping}
            label={i18n.t('settings.recordTyping')}
            onChange={(on) => {
              setRecordTyping(on);
              localStorage.set({ recordTyping: on });
            }}
          />
        </div>
        <div className="flex items-center justify-between gap-3 py-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-foreground">{i18n.t('settings.recordKeys')}</p>
            <p className="text-[11px] text-muted-foreground">{i18n.t('settings.recordKeysHint')}</p>
          </div>
          <Switch
            checked={recordKeys}
            label={i18n.t('settings.recordKeys')}
            onChange={(on) => {
              setRecordKeys(on);
              localStorage.set({ recordKeys: on });
            }}
          />
        </div>
      </SettingsCard>
    ),
    'api-keys': <ApiKeysSettings state={keys} validate={validateApiKey} title={i18n.t('settings.apiKeys')} />,
  };

  if (layout === 'sections') {
    return (
      <div className="mx-auto flex w-full max-w-[960px] gap-8 px-8 py-10">
        <nav className="flex w-[220px] shrink-0 flex-col gap-0.5">
          <div className="mb-4 ml-3 flex items-center">
            <h1 className="text-[22px] font-bold text-foreground">{i18n.t('settings.title')}</h1>
            {savedBadge}
          </div>
          {SETTINGS_SECTIONS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={id === section ? 'page' : undefined}
              onClick={() => showSection(id)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                id === section
                  ? 'bg-secondary font-semibold text-foreground'
                  : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
              }`}
            >
              <Icon size={15} className="shrink-0" />
              {i18n.t(label)}
            </button>
          ))}
        </nav>
        <main className="min-w-0 flex-1 space-y-3">{sections[section]}</main>
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
        {sections['smart-blur']}
        {sections.keyboard}
        <SettingsFooter />
      </div>
    </div>
  );
}
