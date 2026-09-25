import { validateApiKey } from '@mimik/core/capture/ai/validate';
import { i18n } from '@mimik/core/env';
import { AiSettings, BrandingSettings, Switch, useKeyCheck } from '@mimik/ui';
import {
  AppWindow,
  Command,
  Crop,
  ImageIcon,
  Keyboard,
  Monitor,
  MonitorPlay,
  MousePointerClick,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CaptureSettings, CaptureShortcuts } from '../../main/capture/settings';
import { Card } from './Card';
import { zoomLevels } from './lib/zoom-levels';
import { Row } from './Row';
import { Segmented } from './Segmented';
import { ShortcutRecorder } from './ShortcutRecorder';
import { Slider } from './Slider';

type Section = 'capture' | 'ai' | 'branding' | 'shortcuts';

const SECTIONS: { id: Section; labelKey: string; Icon: typeof AppWindow }[] = [
  { id: 'capture', labelKey: 'desktop_capturingSection', Icon: MonitorPlay },
  { id: 'ai', labelKey: 'settings_aiDescriptions', Icon: Sparkles },
  { id: 'branding', labelKey: 'settings_branding', Icon: ImageIcon },
  { id: 'shortcuts', labelKey: 'desktop_shortcutsSection', Icon: Command },
];

const MODES: { id: CaptureSettings['captureMode']; labelKey: string; Icon: typeof AppWindow }[] = [
  { id: 'window', labelKey: 'desktop_modeWindow', Icon: AppWindow },
  { id: 'screen', labelKey: 'desktop_modeScreen', Icon: Monitor },
  { id: 'region', labelKey: 'desktop_modeRegion', Icon: Crop },
];
const KEYS: { id: keyof CaptureShortcuts; labelKey: string }[] = [
  { id: 'startStop', labelKey: 'desktop_shortcutStartStop' },
  { id: 'pauseResume', labelKey: 'desktop_shortcutPauseResume' },
  { id: 'capture', labelKey: 'desktop_shortcutCapture' },
];

export function SettingsPanel() {
  const [section, setSection] = useState<Section>('capture');
  const keyCheck = useKeyCheck(validateApiKey);
  const [settings, setSettings] = useState<CaptureSettings | null>(null);

  useEffect(() => {
    window.mimik.capture.settings.get().then(setSettings);
  }, []);

  const save = async (patch: Partial<CaptureSettings>) => {
    setSettings((current) => current && { ...current, ...patch });
    setSettings(await window.mimik.capture.settings.set(patch));
  };

  return (
    <div className="flex h-[min(650px,80vh)]">
      <nav className="w-[210px] shrink-0 border-r border-border bg-secondary/25 p-3">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSection(item.id)}
            className={`mb-0.5 flex h-9 w-full items-center gap-2.5 rounded-[9px] px-3 text-left text-sm transition-colors ${
              section === item.id
                ? 'bg-secondary font-semibold text-foreground'
                : 'text-foreground hover:bg-secondary/60'
            }`}
          >
            <item.Icon size={15} className={section === item.id ? 'text-accent' : 'text-muted-foreground'} />
            {i18n.t(item.labelKey)}
          </button>
        ))}
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="flex flex-col gap-3.5">
          {section === 'ai' && <AiSettings keyCheck={keyCheck} />}

          {section === 'branding' && <BrandingSettings />}

          {section === 'capture' && settings && (
            <>
              <Card
                icon={MonitorPlay}
                title={i18n.t('desktop_cardScreenshots')}
                hint={i18n.t('desktop_cardScreenshotsHint')}
              >
                <Row label={i18n.t('desktop_captureMode')} hint={i18n.t('desktop_captureModeHint')}>
                  <Segmented
                    label={i18n.t('desktop_captureMode')}
                    value={settings.captureMode}
                    options={MODES.map((mode) => ({ value: mode.id, label: i18n.t(mode.labelKey), Icon: mode.Icon }))}
                    onChange={(captureMode) => save({ captureMode })}
                  />
                </Row>

                <Row label={i18n.t('desktop_screenshotDelay')} hint={i18n.t('desktop_screenshotDelayHint')}>
                  <Slider
                    label={i18n.t('desktop_screenshotDelay')}
                    min={0}
                    max={2000}
                    step={50}
                    value={settings.screenshotDelayMs}
                    shown={`${settings.screenshotDelayMs} ${i18n.t('desktop_milliseconds')}`}
                    onChange={(screenshotDelayMs) => save({ screenshotDelayMs })}
                  />
                </Row>

                <Row label={i18n.t('desktop_zoomLevel')} hint={i18n.t('desktop_zoomLevelHint')} stack>
                  <Segmented
                    label={i18n.t('desktop_zoomLevel')}
                    value={settings.zoomLevel}
                    options={zoomLevels(settings.zoomLevel).map((level) => ({
                      value: level,
                      label: level === null ? i18n.t('desktop_zoomAuto') : `${level}\u00d7`,
                    }))}
                    onChange={(zoomLevel) => save({ zoomLevel })}
                  />
                </Row>

                <Row label={i18n.t('desktop_keepClicksBeyondArea')} hint={i18n.t('desktop_keepClicksBeyondAreaHint')}>
                  <Switch
                    checked={settings.keepClicksBeyondArea}
                    label={i18n.t('desktop_keepClicksBeyondArea')}
                    disabled={settings.captureMode !== 'region'}
                    onChange={(keepClicksBeyondArea) => save({ keepClicksBeyondArea })}
                  />
                </Row>
              </Card>

              <Card
                icon={MousePointerClick}
                title={i18n.t('desktop_cardClickMarks')}
                hint={i18n.t('desktop_cardClickMarksHint')}
              >
                <Row label={i18n.t('desktop_showCursor')} hint={i18n.t('desktop_showCursorHint')}>
                  <Switch
                    checked={settings.showCursor}
                    label={i18n.t('desktop_showCursor')}
                    onChange={(showCursor) => save({ showCursor })}
                  />
                </Row>
              </Card>

              <Card icon={Keyboard} title={i18n.t('desktop_cardKeyboard')} hint={i18n.t('desktop_cardKeyboardHint')}>
                <Row label={i18n.t('desktop_recordTyping')}>
                  <Switch
                    checked={settings.recordTyping}
                    label={i18n.t('desktop_recordTyping')}
                    onChange={(recordTyping) => save({ recordTyping })}
                  />
                </Row>
                <Row label={i18n.t('desktop_readFieldText')} hint={i18n.t('desktop_readFieldTextHint')}>
                  <Switch
                    checked={settings.readFieldText}
                    label={i18n.t('desktop_readFieldText')}
                    disabled={!settings.recordTyping}
                    onChange={(readFieldText) => save({ readFieldText })}
                  />
                </Row>
                <Row label={i18n.t('desktop_typingDebounce')} hint={i18n.t('desktop_typingDebounceHint')}>
                  <Slider
                    label={i18n.t('desktop_typingDebounce')}
                    min={200}
                    max={5000}
                    step={100}
                    value={settings.typingDebounceMs}
                    shown={`${(settings.typingDebounceMs / 1000).toFixed(1)} ${i18n.t('desktop_seconds')}`}
                    disabled={!settings.recordTyping}
                    onChange={(typingDebounceMs) => save({ typingDebounceMs })}
                  />
                </Row>
                <Row label={i18n.t('desktop_recordKeys')} hint={i18n.t('desktop_recordKeysHint')}>
                  <Switch
                    checked={settings.recordKeys}
                    label={i18n.t('desktop_recordKeys')}
                    onChange={(recordKeys) => save({ recordKeys })}
                  />
                </Row>
              </Card>
            </>
          )}

          {section === 'shortcuts' && settings && (
            <Card icon={Command} title={i18n.t('desktop_cardGlobalKeys')} hint={i18n.t('desktop_cardGlobalKeysHint')}>
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
