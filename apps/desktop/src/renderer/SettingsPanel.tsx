import { validateApiKey } from '@mimik/core/capture/ai/validate';
import { i18n } from '@mimik/core/env';
import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP } from '@mimik/core/screenshot/record';
import { CURSOR_STYLES } from '@mimik/core/screenshot/types';
import {
  AiSettings,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useKeyCheck,
} from '@mimik/ui';
import { Command, Keyboard, MonitorPlay } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { CaptureSettings, CaptureShortcuts } from '../main/capture/settings';
import ShortcutRecorder from './ShortcutRecorder';

type Section = 'capture' | 'ai' | 'shortcuts';

const SECTIONS: { id: Section; labelKey: string }[] = [
  { id: 'capture', labelKey: 'desktop_capturingSection' },
  { id: 'ai', labelKey: 'settings_aiDescriptions' },
  { id: 'shortcuts', labelKey: 'desktop_shortcutsSection' },
];

const MODES: { id: CaptureSettings['captureMode']; labelKey: string }[] = [
  { id: 'window', labelKey: 'desktop_modeWindow' },
  { id: 'screen', labelKey: 'desktop_modeScreen' },
  { id: 'region', labelKey: 'desktop_modeRegion' },
];
const KEYS: { id: keyof CaptureShortcuts; labelKey: string }[] = [
  { id: 'startStop', labelKey: 'desktop_shortcutStartStop' },
  { id: 'pauseResume', labelKey: 'desktop_shortcutPauseResume' },
  { id: 'capture', labelKey: 'desktop_shortcutCapture' },
];

const NUMBER = 'h-9 w-24 rounded-lg border-border text-[13px] font-medium';

const ZOOM_LEVELS = Array.from(
  { length: Math.round((MAX_ZOOM - MIN_ZOOM) / ZOOM_STEP) + 1 },
  (_, i) => MIN_ZOOM + i * ZOOM_STEP,
);

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-3 text-sm text-foreground">
      <span className="mr-auto">{label}</span>
      {children}
    </label>
  );
}

function Card({ icon: Icon, title, children }: { icon: typeof Command; title: string; children: ReactNode }) {
  return (
    <div className="space-y-3.5 rounded-[10px] border border-border bg-card p-3.5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary">
          <Icon size={14} className="text-accent" />
        </div>
        <span className="text-xs font-bold text-foreground">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  label,
  hint,
  onChange,
}: {
  checked: boolean;
  label: string;
  hint?: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm text-foreground">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

export default function SettingsPanel() {
  const [section, setSection] = useState<Section>('capture');
  const keyCheck = useKeyCheck(validateApiKey);
  const [settings, setSettings] = useState<CaptureSettings | null>(null);

  useEffect(() => {
    window.mimik.capture.settings.get().then(setSettings);
  }, []);

  const save = async (patch: Partial<CaptureSettings>) => {
    setSettings(await window.mimik.capture.settings.set(patch));
  };

  return (
    <div className="flex h-full">
      <nav className="w-56 shrink-0 border-r border-border bg-secondary/25 p-3">
        <p className="px-3 pb-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {i18n.t('settings_title')}
        </p>
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSection(item.id)}
            className={`mb-0.5 flex h-9 w-full items-center rounded-[9px] px-3 text-left text-sm transition-colors ${
              section === item.id
                ? 'bg-secondary font-semibold text-foreground'
                : 'text-foreground hover:bg-secondary/60'
            }`}
          >
            {i18n.t(item.labelKey)}
          </button>
        ))}
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto px-10 py-8">
        <div className="mx-auto flex max-w-[640px] flex-col gap-4">
          {section === 'ai' && <AiSettings keyCheck={keyCheck} />}

          {section === 'capture' && settings && (
            <>
              <Card icon={MonitorPlay} title={i18n.t('desktop_cardScreenshots')}>
                <Field label={i18n.t('desktop_captureMode')}>
                  <Select
                    value={settings.captureMode}
                    onValueChange={(v) => save({ captureMode: v as CaptureSettings['captureMode'] })}
                  >
                    <SelectTrigger className="h-9 w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODES.map((mode) => (
                        <SelectItem key={mode.id} value={mode.id}>
                          {i18n.t(mode.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Toggle
                  checked={settings.showCursor}
                  label={i18n.t('desktop_showCursor')}
                  onChange={(showCursor) => save({ showCursor })}
                />

                <Field label={i18n.t('desktop_pointerStyle')}>
                  <Select
                    value={settings.cursorStyle}
                    disabled={!settings.showCursor}
                    onValueChange={(v) => save({ cursorStyle: v as CaptureSettings['cursorStyle'] })}
                  >
                    <SelectTrigger className="h-9 w-48 capitalize">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURSOR_STYLES.map((style) => (
                        <SelectItem key={style} value={style} className="capitalize">
                          {style}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label={i18n.t('desktop_screenshotDelay')}>
                  <Input
                    type="number"
                    min={0}
                    max={2000}
                    step={50}
                    className={NUMBER}
                    value={settings.screenshotDelayMs}
                    onChange={(e) => save({ screenshotDelayMs: Number(e.target.value) })}
                  />
                  <span className="text-sm text-muted-foreground">{i18n.t('desktop_milliseconds')}</span>
                </Field>

                <label className="flex items-center gap-3 text-sm text-foreground">
                  <span className="mr-auto flex flex-col gap-0.5">
                    {i18n.t('desktop_zoomLevel')}
                    <span className="text-xs text-muted-foreground">{i18n.t('desktop_zoomLevelHint')}</span>
                  </span>
                  <Select
                    value={settings.zoomLevel === null ? 'auto' : String(settings.zoomLevel)}
                    onValueChange={(v) => save({ zoomLevel: v === 'auto' ? null : Number(v) })}
                  >
                    <SelectTrigger className="h-9 w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">{i18n.t('desktop_zoomAuto')}</SelectItem>
                      {ZOOM_LEVELS.map((level) => (
                        <SelectItem key={level} value={String(level)}>
                          {String(level)}&times;
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                {settings.captureMode === 'region' && (
                  <Toggle
                    checked={settings.captureOutsideClicks}
                    label={i18n.t('desktop_captureOutside')}
                    onChange={(captureOutsideClicks) => save({ captureOutsideClicks })}
                  />
                )}
              </Card>

              <Card icon={Keyboard} title={i18n.t('desktop_cardKeyboard')}>
                <Toggle
                  checked={settings.captureKeys}
                  label={i18n.t('desktop_captureKeys')}
                  onChange={(captureKeys) => save({ captureKeys })}
                />
                <Toggle
                  checked={settings.captureTyping}
                  label={i18n.t('desktop_captureTyping')}
                  onChange={(captureTyping) => save({ captureTyping })}
                />
                <Toggle
                  checked={settings.typingSmartDetection}
                  label={i18n.t('desktop_typingSmart')}
                  hint={i18n.t('desktop_typingSmartHint')}
                  onChange={(typingSmartDetection) => save({ typingSmartDetection })}
                />

                <Field label={i18n.t('desktop_typingDebounce')}>
                  <Input
                    type="number"
                    min={200}
                    max={5000}
                    step={100}
                    disabled={!settings.captureTyping}
                    className={NUMBER}
                    value={settings.typingDebounceMs}
                    onChange={(e) => save({ typingDebounceMs: Number(e.target.value) })}
                  />
                  <span className="text-sm text-muted-foreground">{i18n.t('desktop_milliseconds')}</span>
                </Field>
              </Card>
            </>
          )}

          {section === 'shortcuts' && settings && (
            <Card icon={Command} title={i18n.t('desktop_cardGlobalKeys')}>
              <p className="-mt-1 text-xs text-muted-foreground">{i18n.t('desktop_cardGlobalKeysHint')}</p>
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
