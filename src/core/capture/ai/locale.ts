export function resolveByLocale<T>(table: Readonly<Record<string, T>>, locale: string): T | undefined {
  const normalized = locale.trim().toLowerCase();
  if (!normalized) return undefined;

  const keys = Object.keys(table);
  const exact = keys.find((key) => key.toLowerCase() === normalized);
  if (exact) return table[exact];

  const base = normalized.split('-')[0];
  const sameLanguage = keys.find((key) => key.toLowerCase().split('-')[0] === base);
  return sameLanguage ? table[sameLanguage] : undefined;
}
