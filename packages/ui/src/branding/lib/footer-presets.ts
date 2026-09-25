import { i18n } from '@mimik/core/env';
import { defaultFooterLine } from '@mimik/core/export/branding';

export const footerPresets = () => [
  defaultFooterLine(),
  i18n.t('settings.footerPresetConfidential'),
  i18n.t('settings.footerPresetNoDistribute'),
];
