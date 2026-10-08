import { i18n } from '@mimik/core/env';
import { BRAND_COLORS } from '@mimik/core/export/branding';
import { TARGET_COLORS } from '@mimik/core/screenshot/types';
import { Upload } from 'lucide-react';
import { type ReactNode, useRef } from 'react';
import { useBrandingSettings } from '../../branding/hooks/use-branding-settings';
import { Button } from '../../components/ui/button';
import type { StepProps } from '../types';
import { BrandPicture } from './BrandPicture';
import { ColorSwatches } from './ColorSwatches';
import { HighlightPicture } from './HighlightPicture';
import { OnboardingCard } from './OnboardingCard';
import { OnboardingRow } from './OnboardingRow';
import { StepNav } from './StepNav';

interface MakeItYoursStepProps extends StepProps {
  extraRows?: ReactNode;
}

export function MakeItYoursStep({ onNext, onBack, extraRows }: MakeItYoursStepProps) {
  const branding = useBrandingSettings();
  const logoInput = useRef<HTMLInputElement>(null);

  return (
    <>
      <OnboardingCard title={i18n.t('onboarding.makeTitle')} message={i18n.t('onboarding.makeMessage')}>
        <div className="flex w-full flex-col">
          <OnboardingRow
            picture={<HighlightPicture color={branding.targetColor} />}
            title={i18n.t('settings.targetColor')}
            hint={i18n.t('settings.targetColorHint')}
          >
            <ColorSwatches
              colors={TARGET_COLORS}
              value={branding.targetColor}
              label={i18n.t('settings.targetColor')}
              onChange={branding.setTargetColor}
            />
          </OnboardingRow>
          {extraRows}
          <OnboardingRow
            picture={<BrandPicture color={branding.brandColor} logo={branding.brandLogo} />}
            title={i18n.t('onboarding.brandTitle')}
            hint={i18n.t('onboarding.brandHint')}
          >
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={logoInput}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={(e) => void branding.pickLogo(e.target.files?.[0])}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => logoInput.current?.click()}
                className="mt-2 rounded-lg text-[12px] font-semibold"
              >
                <Upload size={14} />
                {i18n.t(branding.brandLogo ? 'settings.replaceLogo' : 'settings.uploadLogo')}
              </Button>
              <ColorSwatches
                colors={BRAND_COLORS}
                value={branding.brandColor}
                label={i18n.t('settings.brandColor')}
                onChange={branding.setBrandColor}
              />
            </div>
          </OnboardingRow>
        </div>
      </OnboardingCard>
      <StepNav onNext={onNext} onBack={onBack} />
    </>
  );
}
