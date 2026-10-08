import { OnboardingRow, Switch } from '@mimik/ui';
import { useEffect, useState } from 'react';
import { i18n } from '#imports';
import { PRESET_LABELS, type PresetKey } from '@/core/blur/patterns';
import { localStorage } from '@/lib/browser-api/local-storage';
import { BlurPicture } from './BlurPicture';

const PRESET_I18N: Record<PresetKey, string> = {
  email: 'blurPresets.email',
  phone: 'blurPresets.phoneNumbers',
  ssn: 'blurPresets.ssn',
  creditCard: 'blurPresets.creditCard',
  ipAddress: 'blurPresets.ipAddress',
  macAddress: 'blurPresets.macAddress',
};

const DEFAULTS: Record<PresetKey, boolean> = {
  email: true,
  phone: true,
  ssn: false,
  creditCard: false,
  ipAddress: false,
  macAddress: false,
};

export function BlurRow() {
  const [presets, setPresets] = useState(DEFAULTS);
  const keys = Object.keys(PRESET_LABELS) as PresetKey[];
  const on = keys.some((key) => presets[key]);

  useEffect(() => {
    void localStorage.get(['blurPresets']).then((stored) => {
      if (stored.blurPresets && typeof stored.blurPresets === 'object') {
        setPresets((prev) => ({ ...prev, ...(stored.blurPresets as Record<PresetKey, boolean>) }));
      }
    });
  }, []);

  const save = (next: Record<PresetKey, boolean>) => {
    setPresets(next);
    void localStorage.set({ blurPresets: next });
  };

  return (
    <OnboardingRow
      picture={<BlurPicture presets={presets} />}
      title={i18n.t('onboarding.blurTitle')}
      hint={i18n.t('onboarding.blurHint')}
      control={
        <Switch
          checked={on}
          label={i18n.t('onboarding.blurTitle')}
          onChange={(next) =>
            save(next ? DEFAULTS : (Object.fromEntries(keys.map((key) => [key, false])) as Record<PresetKey, boolean>))
          }
        />
      }
    >
      {on && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {keys.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={presets[key]}
              onClick={() => save({ ...presets, [key]: !presets[key] })}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                presets[key] ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground hover:bg-lavender'
              }`}
            >
              {i18n.t(PRESET_I18N[key])}
            </button>
          ))}
        </div>
      )}
    </OnboardingRow>
  );
}
