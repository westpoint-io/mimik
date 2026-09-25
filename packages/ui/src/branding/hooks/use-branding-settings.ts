import { localStorage } from '@mimik/core/env';
import { type BrandLogo, defaultFooterLine, makeBrandLogo } from '@mimik/core/export/branding';
import { DEFAULT_TARGET_COLOR } from '@mimik/core/screenshot/types';
import { useEffect, useState } from 'react';

const BRANDING_KEYS = ['targetColor', 'brandLogo', 'brandFooter', 'brandAttribution'] as const;

export interface BrandingSettingsState {
  targetColor: string;
  brandLogo: BrandLogo | null;
  brandFooter: string;
  brandAttribution: boolean;
  setTargetColor: (color: string) => void;
  pickLogo: (file: File | undefined) => Promise<void>;
  removeLogo: () => void;
  setBrandFooter: (footer: string) => void;
  toggleAttribution: () => void;
}

export function useBrandingSettings(onDirty?: (patch: Record<string, unknown>) => void): BrandingSettingsState {
  const [targetColor, setColor] = useState<string>(DEFAULT_TARGET_COLOR);
  const [brandLogo, setLogo] = useState<BrandLogo | null>(null);
  const [brandFooter, setFooter] = useState('');
  const [brandAttribution, setAttribution] = useState(true);

  useEffect(() => {
    localStorage.get(BRANDING_KEYS).then((stored) => {
      if (stored.targetColor) setColor(stored.targetColor);
      if (stored.brandLogo) setLogo(stored.brandLogo);
      setFooter(typeof stored.brandFooter === 'string' ? stored.brandFooter : defaultFooterLine());
      if (stored.brandAttribution === false) setAttribution(false);
    });
  }, []);

  const save = (patch: Record<string, unknown>) => {
    void localStorage.set(patch as never);
    onDirty?.(patch);
  };

  return {
    targetColor,
    brandLogo,
    brandFooter,
    brandAttribution,
    setTargetColor: (color) => {
      setColor(color);
      save({ targetColor: color });
    },
    pickLogo: async (file) => {
      if (!file) return;
      const logo = await makeBrandLogo(file);
      setLogo(logo);
      save({ brandLogo: logo });
    },
    removeLogo: () => {
      setLogo(null);
      save({ brandLogo: null });
    },
    setBrandFooter: (footer) => {
      setFooter(footer);
      save({ brandFooter: footer });
    },
    toggleAttribution: () => {
      setAttribution(!brandAttribution);
      save({ brandAttribution: !brandAttribution });
    },
  };
}
