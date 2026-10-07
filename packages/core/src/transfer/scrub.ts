export const SCRUB_PLACEHOLDER = '…';

export const MIN_BARE_SCRUB = 4;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function scrubValues(text: string, values: readonly string[]): string {
  let out = text;

  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    const escaped = escapeRegExp(value);

    out = out.replace(new RegExp(`"${escaped}"`, 'gi'), `"${SCRUB_PLACEHOLDER}"`);
    if (value.length >= MIN_BARE_SCRUB) {
      out = out.replace(new RegExp(escaped, 'gi'), SCRUB_PLACEHOLDER);
    }
  }

  return out;
}

function decodePart(raw: string, plusIsSpace: boolean): string | null {
  try {
    return decodeURIComponent(plusIsSpace ? raw.replace(/\+/g, ' ') : raw);
  } catch {
    return null;
  }
}

function scrubPart(raw: string, values: readonly string[], plusIsSpace: boolean): string {
  const decoded = decodePart(raw, plusIsSpace);
  if (decoded === null) return raw;
  const exact = values.some((value) => value.trim() !== '' && decoded === value.trim());
  const scrubbed = exact ? SCRUB_PLACEHOLDER : scrubValues(decoded, values);
  return scrubbed === decoded ? raw : encodeURIComponent(scrubbed);
}

function scrubQuery(search: string, values: readonly string[]): string {
  if (search.length <= 1) return search;
  const pairs = search
    .slice(1)
    .split('&')
    .map((pair) => {
      const at = pair.indexOf('=');
      if (at === -1) return scrubPart(pair, values, true);
      return `${pair.slice(0, at)}=${scrubPart(pair.slice(at + 1), values, true)}`;
    });
  return `?${pairs.join('&')}`;
}

export function scrubUrl(url: string, values: readonly string[]): string {
  if (!url || values.length === 0) return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return scrubValues(url, values);
  }
  if (parsed.origin === 'null' && parsed.protocol !== 'file:') return scrubValues(url, values);

  const pathname = parsed.pathname
    .split('/')
    .map((segment) => scrubPart(segment, values, false))
    .join('/');
  const search = scrubQuery(parsed.search, values);
  const hash = parsed.hash ? `#${scrubPart(parsed.hash.slice(1), values, false)}` : '';
  if (pathname === parsed.pathname && search === parsed.search && hash === parsed.hash) return url;

  const next = new URL(parsed.href);
  next.pathname = pathname;
  next.search = search;
  next.hash = hash;
  return next.href;
}

const CAPTURED_TEXT_LIMIT = 80;

function variantsOf(value: string): string[] {
  const variants = new Set<string>([value]);
  const firstLine = value
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 2);

  for (const candidate of [firstLine, value.slice(0, CAPTURED_TEXT_LIMIT), firstLine?.slice(0, CAPTURED_TEXT_LIMIT)]) {
    if (candidate && candidate.length >= MIN_BARE_SCRUB) variants.add(candidate);
  }
  return [...variants];
}

export function typedValues(steps: readonly { inputValue?: string }[]): string[] {
  const values = new Set<string>();
  for (const step of steps) {
    const value = step.inputValue?.trim();
    if (!value) continue;
    for (const variant of variantsOf(value)) values.add(variant);
  }
  return [...values].sort((a, b) => b.length - a.length);
}
