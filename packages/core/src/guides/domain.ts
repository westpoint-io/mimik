export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function extractOrigin(url: string): string {
  try {
    const { protocol, origin } = new URL(url);
    return /^https?:$/.test(protocol) ? origin : '';
  } catch {
    return '';
  }
}

function mostCommon(steps: { url?: string | null }[], extract: (url: string) => string): string {
  const counts = new Map<string, number>();
  for (const s of steps) {
    const key = extract(s.url || '');
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }
  let best = '';
  let max = 0;
  for (const [key, c] of counts) {
    if (c > max) {
      max = c;
      best = key;
    }
  }
  return best;
}

export function getMostCommonDomain(steps: { url?: string | null }[]): string {
  return mostCommon(steps, extractDomain);
}

export function getMostCommonOrigin(steps: { url?: string | null }[]): string {
  return mostCommon(steps, extractOrigin);
}
