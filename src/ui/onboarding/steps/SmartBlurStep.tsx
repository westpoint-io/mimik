import { useEffect, useState } from 'react';
import { i18n } from '#imports';
import { PRESET_LABELS, type PresetKey } from '@/core/blur/regexes';
import { localStorage } from '@/lib/browser-api/local-storage';
import { ProgressDots } from '../ProgressDots';
import type { StepProps } from '../types';

const BLUR_PRESET_I18N: Record<PresetKey, string> = {
  email: 'email',
  phone: 'phoneNumbers',
  ssn: 'ssn',
  creditCard: 'creditCard',
  ipAddress: 'ipAddress',
  macAddress: 'macAddress',
};

export function SmartBlurStep({ onNext, onBack, index, total }: StepProps) {
  const [blurPresets, setBlurPresets] = useState<Record<PresetKey, boolean>>({
    email: true,
    phone: true,
    ssn: false,
    creditCard: false,
    ipAddress: false,
    macAddress: false,
  });

  useEffect(() => {
    localStorage.get(['blurPresets']).then((stored) => {
      if (stored.blurPresets && typeof stored.blurPresets === 'object') {
        setBlurPresets((prev) => ({ ...prev, ...(stored.blurPresets as Record<PresetKey, boolean>) }));
      }
    });
  }, []);

  const handleToggle = (key: PresetKey) => {
    setBlurPresets((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.set({ blurPresets: next });
      return next;
    });
  };

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col justify-center" style={{ padding: '80px 64px' }}>
        <div className="max-w-md">
          <p className="text-xs font-semibold text-accent mb-2 tracking-wide uppercase">
            {i18n.t('onboarding.stepOf', [String(index), String(total)])}
          </p>
          <h1 className="text-3xl font-extrabold text-foreground leading-tight mb-2">
            {i18n.t('onboarding.blurTitle')}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8">{i18n.t('onboarding.blurMessage')}</p>

          <div className="space-y-1 mb-8 border border-border rounded-2xl p-4">
            {(Object.keys(PRESET_LABELS) as PresetKey[]).map((key, i, arr) => (
              <div
                key={key}
                className={`flex items-center justify-between py-3 ${i < arr.length - 1 ? 'border-b border-secondary' : ''}`}
              >
                <span className="text-sm font-medium text-foreground">
                  {i18n.t(`blurPresets.${BLUR_PRESET_I18N[key]}`)}
                </span>
                <button
                  onClick={() => handleToggle(key)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    blurPresets[key] ? 'bg-accent' : 'bg-border'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                      blurPresets[key] ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="px-8 py-3 bg-card text-foreground border border-border rounded-xl font-semibold text-sm hover:border-accent hover:text-accent transition-colors"
            >
              {i18n.t('common.back')}
            </button>
            <button
              onClick={onNext}
              className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              {i18n.t('common.continue')}
            </button>
          </div>

          <div className="mt-6">
            <ProgressDots current={index} total={total} />
          </div>
        </div>
      </div>
      <div className="w-1/2 bg-deep flex items-center justify-center relative overflow-hidden">
        <div className="absolute w-[350px] h-[350px] bg-[radial-gradient(circle,rgba(79,70,229,0.25),transparent_70%)] bottom-[20%] right-[20%]" />
        <div className="animate-[float_4s_ease-in-out_infinite] relative z-10">
          <div className="bg-white rounded-2xl p-7 shadow-lg" style={{ minWidth: 320 }}>
            <p className="text-xs font-semibold text-foreground mb-4">{i18n.t('onboarding.screenshotPreview')}</p>
            {[
              { icon: '@', label: i18n.t('blurPresets.email'), value: 'luis@company.com', blurred: true },
              { icon: '#', label: i18n.t('blurPresets.phoneNumbers'), value: '(555) 867-5309', blurred: true },
              { icon: 'ID', label: i18n.t('blurPresets.ssn'), value: i18n.t('onboarding.notEnabled'), blurred: false },
              {
                icon: '$',
                label: i18n.t('blurPresets.creditCard'),
                value: i18n.t('onboarding.notEnabled'),
                blurred: false,
              },
              {
                icon: 'IP',
                label: i18n.t('blurPresets.ipAddress'),
                value: i18n.t('onboarding.notEnabled'),
                blurred: false,
              },
            ].map((row, i, arr) => (
              <div
                key={row.label}
                className={`flex items-center gap-3 py-2.5 ${i < arr.length - 1 ? 'border-b border-border' : ''}`}
              >
                <div className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center text-[10px] font-semibold text-accent">
                  {row.icon}
                </div>
                <span className="text-xs text-muted-foreground flex-1">{row.label}</span>
                <span
                  className={`text-xs font-semibold ${row.blurred ? 'text-foreground blur-[4px] select-none' : 'text-muted-foreground font-normal'}`}
                >
                  {row.value}
                </span>
              </div>
            ))}
            <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-success bg-success/10 px-2.5 py-1 rounded mt-3">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              {i18n.t('onboarding.categoriesProtected', ['2'])}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
