const TRADITIONAL_CHINESE = /^zh-(hant|hk|mo|tw)\b/;

export function resolveByLocale<T>(table: Readonly<Record<string, T>>, locale: string): T | undefined {
  const normalized = locale.trim().toLowerCase();
  if (!normalized) return undefined;

  const keys = Object.keys(table);
  const exact = keys.find((key) => key.toLowerCase() === normalized);
  if (exact) return table[exact];

  const traditional = TRADITIONAL_CHINESE.test(normalized) && keys.find((key) => key.toLowerCase() === 'zh-tw');
  if (traditional) return table[traditional];

  const base = normalized.split('-')[0];
  const sameLanguage = keys.find((key) => key.toLowerCase().split('-')[0] === base && key.toLowerCase() !== 'zh-tw');
  return sameLanguage ? table[sameLanguage] : undefined;
}
