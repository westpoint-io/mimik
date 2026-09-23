import dayjs from 'dayjs';
import { getDayjsLocale } from './dayjs-locale';

export function formatDateShort(ts: number): string {
  const locale = getDayjsLocale();
  const d = locale ? dayjs(ts).locale(locale) : dayjs(ts);
  return d.format('MMM D');
}
