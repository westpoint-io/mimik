import { i18n } from '#imports';
import { finishGuide } from '@/core/capture/ai/finish-guide';
import { settleDescriptions } from '@/core/capture/ai/settle-descriptions';
import { getGuideDomain } from '@/core/guides/service';
import { whenNarrationSettled } from './voice';

async function domainTitle(guideId: string): Promise<string> {
  const domain = await getGuideDomain(guideId);
  return domain ? i18n.t('background.guideOnDomain', [domain]) : i18n.t('background.newGuide');
}

export async function settlePendingDescriptions(guideId: string) {
  await whenNarrationSettled();
  await settleDescriptions(guideId);
}

export function generateGuideMetaOnStop(guideId: string) {
  return finishGuide(guideId, { fallbackTitle: domainTitle, settleNarration: whenNarrationSettled });
}
