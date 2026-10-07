import { i18n } from '#imports';

export function timeAgo(createdAt: number): string {
  const diff = Math.floor((Date.now() - createdAt) / 1000);
  if (diff < 3) return i18n.t('recording.justNow');
  if (diff < 60) return i18n.t('recording.secondsAgo', [String(diff)]);
  return i18n.t('recording.minutesAgo', [String(Math.floor(diff / 60))]);
}
