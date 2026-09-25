import { i18n } from '@mimik/core/env';
import { TARGET_COLORS } from '@mimik/core/screenshot/types';
import { ChevronDown, ImageIcon, Target, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { ColorPicker } from '../../annotation/components/ColorPicker';
import { SettingsCard } from '../../common/components/SettingsCard';
import { Switch } from '../../common/components/Switch';
import { Input } from '../../components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { useBrandingSettings } from '../hooks/use-branding-settings';
import { footerPresets } from '../lib/footer-presets';

export function BrandingSettings({ onChange }: { onChange?: (patch: Record<string, unknown>) => void }) {
  const {
    targetColor,
    brandLogo,
    brandFooter,
    brandAttribution,
    setTargetColor,
    pickLogo,
    removeLogo,
    setBrandFooter,
    toggleAttribution,
  } = useBrandingSettings(onChange);
  const logoInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <SettingsCard
        icon={Target}
        title={i18n.t('settings.targetColor')}
        hint={i18n.t('settings.targetColorHint')}
        action={
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
        }
      />

      <SettingsCard icon={ImageIcon} title={i18n.t('settings.branding')}>
        <div>
          <label className="block text-[11px] font-semibold text-foreground mb-1">{i18n.t('settings.brandLogo')}</label>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={(e) => pickLogo(e.target.files?.[0])}
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
                onClick={removeLogo}
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
            className="h-8 text-[13px] rounded-lg border-border"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {footerPresets().map((preset) => (
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
          <Switch checked={brandAttribution} label={i18n.t('settings.attribution')} onChange={toggleAttribution} />
        </div>
      </SettingsCard>
    </>
  );
}
