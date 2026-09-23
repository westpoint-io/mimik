import dayjs from 'dayjs';
import { getDayjsLocale } from './dayjs-locale';

export function formatRelativeTime(ts: number): string {
  const locale = getDayjsLocale();
  return locale ? dayjs(ts).locale(locale).fromNow() : dayjs(ts).fromNow();
}
