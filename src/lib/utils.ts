import { type ClassValue, clsx } from 'clsx';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/es';
import 'dayjs/locale/pt-br';
import 'dayjs/locale/fr';
import 'dayjs/locale/de';
import 'dayjs/locale/zh-cn';
import { twMerge } from 'tailwind-merge';
import { i18n } from '#imports';

dayjs.extend(relativeTime);

const DAYJS_LOCALE_MAP: Record<string, string> = {
  es: 'es',
  'pt-BR': 'pt-br',
  pt: 'pt-br',
  fr: 'fr',
  de: 'de',
  'zh-CN': 'zh-cn',
  zh: 'zh-cn',
};

function getDayjsLocale(): string | undefined {
  try {
    const locale = i18n.t('meta.locale');
    if (locale && DAYJS_LOCALE_MAP[locale]) return DAYJS_LOCALE_MAP[locale];
    const key = locale?.split(/[-_]/)[0]?.toLowerCase();
    if (key && DAYJS_LOCALE_MAP[key]) return DAYJS_LOCALE_MAP[key];
  } catch {}
  return undefined;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(ts: number): string {
  const locale = getDayjsLocale();
  const d = locale ? dayjs(ts).locale(locale) : dayjs(ts);
  return d.format('MMM D, YYYY');
}

export function formatDateShort(ts: number): string {
  const locale = getDayjsLocale();
  const d = locale ? dayjs(ts).locale(locale) : dayjs(ts);
  return d.format('MMM D');
}

export function formatDateTime(ts: number): string {
  const locale = getDayjsLocale();
  const d = locale ? dayjs(ts).locale(locale) : dayjs(ts);
  return d.format('MMM D, YYYY — h:mm A');
}

export function formatRelativeTime(ts: number): string {
  const locale = getDayjsLocale();
  return locale ? dayjs(ts).locale(locale).fromNow() : dayjs(ts).fromNow();
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function getMostCommonDomain(steps: { url?: string | null }[]): string {
  const counts = new Map<string, number>();
  for (const s of steps) {
    const d = extractDomain(s.url || '');
    if (d) counts.set(d, (counts.get(d) || 0) + 1);
  }
  let best = '';
  let max = 0;
  for (const [d, c] of counts) {
    if (c > max) {
      max = c;
      best = d;
    }
  }
  return best;
}

export function getFaviconUrl(url: string, size = 64): string {
  try {
    const full = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(full)}&size=${size}&drop_404_icon=true`;
  } catch {
    return '';
  }
}

const INITIAL_GRADIENTS = [
  ['#6366F1', '#818CF8'],
  ['#8B5CF6', '#A78BFA'],
  ['#EC4899', '#F472B6'],
  ['#14B8A6', '#2DD4BF'],
  ['#F59E0B', '#FBBF24'],
  ['#3B82F6', '#60A5FA'],
] as const;

export function getDomainInitial(domain: string): { letter: string; gradient: readonly [string, string] } {
  const letter = domain.charAt(0).toUpperCase();
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = (hash * 31 + domain.charCodeAt(i)) | 0;
  }
  const gradient = INITIAL_GRADIENTS[Math.abs(hash) % INITIAL_GRADIENTS.length];
  return { letter, gradient };
}
