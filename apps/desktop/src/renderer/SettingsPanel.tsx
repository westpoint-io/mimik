import { validateApiKey } from '@mimik/core/capture/ai/validate';
import { i18n } from '@mimik/core/env';
import AiSettings from '@mimik/ui/shared/AiSettings';
import { useEffect, useState } from 'react';
import type { CaptureSettings, CaptureShortcuts } from '../main/capture/settings';
import ShortcutRecorder from './ShortcutRecorder';

type Section = 'capture' | 'ai' | 'shortcuts';

const SECTIONS: { id: Section; labelKey: string }[] = [
  { id: 'capture', labelKey: 'desktop_capturingSection' },
  { id: 'ai', labelKey: 'settings_aiDescriptions' },
  { id: 'shortcuts', labelKey: 'desktop_shortcutsSection' },
];

const STYLES: CaptureSettings['cursorStyle'][] = ['arrow', 'hand', 'dot'];
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

const SELECT = 'h-9 rounded-[10px] border border-border bg-card px-2.5 text-sm text-foreground';

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
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5" />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm text-foreground">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

export default function SettingsPanel({ onClose }: { onClose(): void }) {
  const [section, setSection] = useState<Section>('capture');
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
        <button
          type="button"
          onClick={onClose}
          className="mt-3 flex h-9 w-full items-center rounded-[9px] px-3 text-left text-sm text-muted-foreground hover:bg-secondary/60"
        >
          {i18n.t('common_close')}
        </button>
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto px-10 py-8">
        <div className="mx-auto flex max-w-[640px] flex-col gap-5">
          {section === 'ai' && <AiSettings validate={validateApiKey} />}

          {section === 'capture' && settings && (
            <>
              <label className="flex items-center gap-3 text-sm text-foreground">
                <span className="mr-auto">{i18n.t('desktop_captureMode')}</span>
                <select
                  className={SELECT}
                  value={settings.captureMode}
                  onChange={(e) => save({ captureMode: e.target.value as CaptureSettings['captureMode'] })}
                >
                  {MODES.map((mode) => (
                    <option key={mode.id} value={mode.id}>
                      {i18n.t(mode.labelKey)}
                    </option>
                  ))}
                </select>
              </label>

              <Toggle
                checked={settings.showCursor}
                label={i18n.t('desktop_showCursor')}
                onChange={(showCursor) => save({ showCursor })}
              />

              <label className="flex items-center gap-3 text-sm text-foreground">
                <span className="mr-auto">{i18n.t('desktop_pointerStyle')}</span>
                <select
                  className={SELECT}
                  value={settings.cursorStyle}
                  disabled={!settings.showCursor}
                  onChange={(e) => save({ cursorStyle: e.target.value as CaptureSettings['cursorStyle'] })}
                >
                  {STYLES.map((style) => (
                    <option key={style} value={style}>
                      {style}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-3 text-sm text-foreground">
                <span className="mr-auto">{i18n.t('desktop_screenshotDelay')}</span>
                <input
                  type="number"
                  min={0}
                  max={2000}
                  step={50}
                  className={`${SELECT} w-24`}
                  value={settings.screenshotDelayMs}
                  onChange={(e) => save({ screenshotDelayMs: Number(e.target.value) })}
                />
                <span className="text-muted-foreground">{i18n.t('desktop_milliseconds')}</span>
              </label>

              {settings.captureMode === 'region' && (
                <Toggle
                  checked={settings.captureOutsideClicks}
                  label={i18n.t('desktop_captureOutside')}
                  onChange={(captureOutsideClicks) => save({ captureOutsideClicks })}
                />
              )}

              <div className="my-1 h-px bg-border" />

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

              <label className="flex items-center gap-3 text-sm text-foreground">
                <span className="mr-auto">{i18n.t('desktop_typingDebounce')}</span>
                <input
                  type="number"
                  min={200}
                  max={5000}
                  step={100}
                  disabled={!settings.captureTyping}
                  className={`${SELECT} w-24`}
                  value={settings.typingDebounceMs}
                  onChange={(e) => save({ typingDebounceMs: Number(e.target.value) })}
                />
                <span className="text-muted-foreground">{i18n.t('desktop_milliseconds')}</span>
              </label>
            </>
          )}

          {section === 'shortcuts' &&
            settings &&
            KEYS.map((key) => (
              <ShortcutRecorder
                key={key.id}
                label={i18n.t(key.labelKey)}
                value={settings.shortcuts[key.id]}
                onChange={(next) => save({ shortcuts: { ...settings.shortcuts, [key.id]: next } })}
              />
            ))}
        </div>
      </div>
    </div>
  );
}
