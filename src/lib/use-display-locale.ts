import { useEffect, useState } from 'react';
import { getDisplayLocale, loadDisplayLocale, subscribeDisplayLocale } from '@/lib/i18n-runtime';

export function useDisplayLocale(): string | undefined {
  const [locale, setLocale] = useState(getDisplayLocale());

  useEffect(() => {
    const unsubscribe = subscribeDisplayLocale(() => setLocale(getDisplayLocale()));
    void loadDisplayLocale();
    return unsubscribe;
  }, []);

  return locale;
}
