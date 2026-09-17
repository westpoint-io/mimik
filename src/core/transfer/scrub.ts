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
