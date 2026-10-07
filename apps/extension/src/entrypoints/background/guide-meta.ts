import { i18n } from '#imports';
import { finishGuide } from '@/core/capture/ai/finish-guide';
import { getGuideDomain } from '@/core/guides/service';
import { whenNarrationSettled } from './voice';

async function domainTitle(guideId: string): Promise<string> {
  const domain = await getGuideDomain(guideId);
  return domain ? i18n.t('guide.onDomain', [domain]) : i18n.t('guide.newGuide');
}

export function generateGuideMetaOnStop(guideId: string) {
  return finishGuide(guideId, { fallbackTitle: domainTitle, settleNarration: whenNarrationSettled });
}
