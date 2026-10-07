import { validateApiKey } from '@mimik/core/capture/ai/validate';
import { i18n } from '@mimik/core/env';
import { fetchVoices } from '@mimik/core/export/voiceover/client';
import {
  AiSettings,
  ApiKeysSettings,
  BrandingSettings,
  NarrationSettings,
  Segmented,
  Switch,
  useApiKeys,
  VoiceoverSettings,
} from '@mimik/ui';
import {
  AppWindow,
  Command,
  Crop,
  ImageIcon,
  Keyboard,
  KeyRound,
  Monitor,
  MonitorPlay,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CaptureSettings, CaptureShortcuts } from '../../main/capture/settings';
import { useMicrophoneGate } from '../hooks/use-microphone-gate';
import { requestMicrophoneAccess } from '../lib/request-microphone-access';
import { Card } from './Card';
import { GeneralSettings } from './GeneralSettings';
import { REOPEN_SETTINGS } from './lib/reopen-settings';
import { zoomLevels } from './lib/zoom-levels';
import { Row } from './Row';
import { ShortcutRecorder } from './ShortcutRecorder';
import { Slider } from './Slider';

type Section = 'general' | 'capture' | 'ai' | 'branding' | 'shortcuts' | 'keys';

const SECTIONS: { id: Section; labelKey: string; Icon: typeof AppWindow }[] = [
  { id: 'general', labelKey: 'desktop.generalSection', Icon: SlidersHorizontal },
  { id: 'capture', labelKey: 'desktop.capturingSection', Icon: MonitorPlay },
  { id: 'ai', labelKey: 'settings.aiSection', Icon: Sparkles },
  { id: 'branding', labelKey: 'settings.branding', Icon: ImageIcon },
  { id: 'shortcuts', labelKey: 'desktop.shortcutsSection', Icon: Command },
  { id: 'keys', labelKey: 'settings.apiKeys', Icon: KeyRound },
];

const MODES: { id: CaptureSettings['captureMode']; labelKey: string; Icon: typeof AppWindow }[] = [
  { id: 'window', labelKey: 'desktop.modeWindow', Icon: AppWindow },
  { id: 'screen', labelKey: 'desktop.modeScreen', Icon: Monitor },
  { id: 'area', labelKey: 'desktop.modeArea', Icon: Crop },
];
const KEYS: { id: keyof CaptureShortcuts; labelKey: string }[] = [
  { id: 'startStop', labelKey: 'desktop.shortcutStartStop' },
  { id: 'pauseResume', labelKey: 'desktop.shortcutPauseResume' },
  { id: 'capture', labelKey: 'desktop.shortcutCapture' },
];

export function SettingsPanel({ onSaved }: { onSaved: () => void }) {
  const [section, setSection] = useState<Section>(() => {
    const reopened = sessionStorage.getItem(REOPEN_SETTINGS) as Section | null;
    sessionStorage.removeItem(REOPEN_SETTINGS);
    return reopened ?? 'general';
  });
  const keys = useApiKeys({ onChange: onSaved });
  const microphone = useMicrophoneGate();
  const [settings, setSettings] = useState<CaptureSettings | null>(null);

  useEffect(() => {
    window.mimik.capture.settings.get().then(setSettings);
  }, []);

  const save = async (patch: Partial<CaptureSettings>) => {
    setSettings((current) => current && { ...current, ...patch });
    setSettings(await window.mimik.capture.settings.set(patch));
    onSaved();
  };

  return (
    <div className="flex h-[min(650px,80vh)]">
      <nav className="w-[210px] shrink-0 border-r border-border bg-secondary/25 p-3">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSection(item.id)}
            className={`mb-0.5 flex min-h-9 w-full items-start gap-2.5 rounded-[9px] px-3 py-2 text-left text-sm leading-5 transition-colors ${
              section === item.id
                ? 'bg-secondary font-semibold text-foreground'
                : 'text-foreground hover:bg-secondary/60'
            }`}
          >
            <item.Icon
              size={15}
              className={`mt-0.5 shrink-0 ${section === item.id ? 'text-accent' : 'text-muted-foreground'}`}
            />
            {i18n.t(item.labelKey)}
          </button>
        ))}
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="flex flex-col gap-3.5">
          {section === 'ai' && (
            <>
              <AiSettings keys={keys} onOpenKeys={() => setSection('keys')} onChange={onSaved} />
              <NarrationSettings
                keys={keys}
                onOpenKeys={() => setSection('keys')}
                onChange={onSaved}
                onRequestAccess={requestMicrophoneAccess}
                access={microphone.row}
                microphoneDisabled={microphone.locked}
                liveMeter
              />
              <VoiceoverSettings
                keys={keys.keys}
                listVoices={fetchVoices}
                onOpenKeys={() => setSection('keys')}
                onChange={onSaved}
              />
            </>
          )}

          {section === 'keys' && <ApiKeysSettings state={keys} validate={validateApiKey} />}

          {section === 'branding' && <BrandingSettings onChange={onSaved} />}

          {section === 'capture' && settings && (
            <>
              <Card
                icon={MonitorPlay}
                title={i18n.t('desktop.cardScreenshots')}
                hint={i18n.t('desktop.cardScreenshotsHint')}
              >
                <Row label={i18n.t('desktop.captureMode')} hint={i18n.t('desktop.captureModeHint')}>
                  <Segmented
                    label={i18n.t('desktop.captureMode')}
                    value={settings.captureMode}
                    options={MODES.map((mode) => ({ value: mode.id, label: i18n.t(mode.labelKey), Icon: mode.Icon }))}
                    onChange={(captureMode) => save({ captureMode })}
                  />
                </Row>

                <Row label={i18n.t('desktop.screenshotDelay')} hint={i18n.t('desktop.screenshotDelayHint')}>
                  <Slider
                    label={i18n.t('desktop.screenshotDelay')}
                    min={0}
                    max={2000}
                    step={50}
                    value={settings.screenshotDelayMs}
                    shown={`${settings.screenshotDelayMs} ${i18n.t('desktop.milliseconds')}`}
                    onChange={(screenshotDelayMs) => save({ screenshotDelayMs })}
                  />
                </Row>

                <Row label={i18n.t('desktop.zoomLevel')} hint={i18n.t('desktop.zoomLevelHint')} stack>
                  <Segmented
                    label={i18n.t('desktop.zoomLevel')}
                    value={settings.zoomLevel}
                    options={zoomLevels(settings.zoomLevel).map((level) => ({
                      value: level,
                      label: level === null ? i18n.t('desktop.zoomAuto') : `${level}\u00d7`,
                    }))}
                    onChange={(zoomLevel) => save({ zoomLevel })}
                  />
                </Row>

                <Row label={i18n.t('desktop.keepClicksBeyondArea')} hint={i18n.t('desktop.keepClicksBeyondAreaHint')}>
                  <Switch
                    checked={settings.keepClicksBeyondArea}
                    label={i18n.t('desktop.keepClicksBeyondArea')}
                    disabled={settings.captureMode !== 'area'}
                    onChange={(keepClicksBeyondArea) => save({ keepClicksBeyondArea })}
                  />
                </Row>
              </Card>

              <Card icon={Keyboard} title={i18n.t('settings.cardKeyboard')} hint={i18n.t('settings.cardKeyboardHint')}>
                <Row label={i18n.t('desktop.recordTyping')} hint={i18n.t('desktop.recordTypingHint')}>
                  <Switch
                    checked={settings.recordTyping}
                    label={i18n.t('desktop.recordTyping')}
                    onChange={(recordTyping) => save({ recordTyping })}
                  />
                </Row>
                <Row label={i18n.t('desktop.typingDebounce')} hint={i18n.t('desktop.typingDebounceHint')}>
                  <Slider
                    label={i18n.t('desktop.typingDebounce')}
                    min={200}
                    max={5000}
                    step={100}
                    value={settings.typingDebounceMs}
                    shown={`${(settings.typingDebounceMs / 1000).toFixed(1)} ${i18n.t('desktop.seconds')}`}
                    disabled={!settings.recordTyping}
                    onChange={(typingDebounceMs) => save({ typingDebounceMs })}
                  />
                </Row>
                <Row label={i18n.t('settings.recordKeys')} hint={i18n.t('settings.recordKeysHint')}>
                  <Switch
                    checked={settings.recordKeys}
                    label={i18n.t('settings.recordKeys')}
                    onChange={(recordKeys) => save({ recordKeys })}
                  />
                </Row>
              </Card>
            </>
          )}

          {section === 'general' && <GeneralSettings onSaved={onSaved} />}

          {section === 'shortcuts' && settings && (
            <Card icon={Command} title={i18n.t('desktop.cardGlobalKeys')} hint={i18n.t('desktop.cardGlobalKeysHint')}>
              {KEYS.map((key) => (
                <ShortcutRecorder
                  key={key.id}
                  label={i18n.t(key.labelKey)}
                  value={settings.shortcuts[key.id]}
                  onChange={(next) => save({ shortcuts: { ...settings.shortcuts, [key.id]: next } })}
                />
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
