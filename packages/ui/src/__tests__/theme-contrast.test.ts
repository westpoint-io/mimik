import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

type Rgba = [number, number, number, number];

const css = readFileSync(join(process.cwd(), 'packages/ui/src/theme.css'), 'utf8');

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name = '', value = '']) => [name, value.trim()]),
  );
}

const THEMES = { light: block(':root,'), dark: block('.dark {') };

function toSrgb(linear: number): number {
  const clamped = Math.min(1, Math.max(0, linear));
  return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
}

function parse(value: string | undefined, tokens: Record<string, string>): Rgba {
  if (value === undefined) throw new Error('missing colour');
  const reference = value.match(/^var\(--([\w-]+)\)$/);
  if (reference) return parse(tokens[reference[1] ?? ''], tokens);
  if (value === 'transparent') return [0, 0, 0, 0];
  if (value.startsWith('#')) {
    const hex = value.length === 4 ? [...value.slice(1)].map((c) => c + c).join('') : value.slice(1);
    const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
    return [r ?? 0, g ?? 0, b ?? 0, 1];
  }
  const numbers = (value.match(/[\d.]+%?/g) ?? []).map((n) =>
    n.endsWith('%') ? Number.parseFloat(n) / 100 : Number(n),
  );
  const [first = 0, second = 0, third = 0, alpha = 1] = numbers;
  if (value.startsWith('rgb')) return [first / 255, second / 255, third / 255, alpha];
  if (value.startsWith('oklch')) {
    const [lightness, chroma, hue] = [first, second, third];
    const a = chroma * Math.cos((hue * Math.PI) / 180);
    const b = chroma * Math.sin((hue * Math.PI) / 180);
    const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [
      toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
      toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
      toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
      alpha,
    ];
  }
  throw new Error(`cannot read ${value}`);
}

function over(top: Rgba, base: Rgba): Rgba {
  const [r, g, b, alpha] = top;
  return [r * alpha + base[0] * (1 - alpha), g * alpha + base[1] * (1 - alpha), b * alpha + base[2] * (1 - alpha), 1];
}

function luminance([r, g, b]: Rgba): number {
  const channel = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(text: string, fill: string, surface: string, tokens: Record<string, string>): number {
  const background = over(parse(tokens[fill], tokens), parse(tokens[surface], tokens));
  const foreground = over(parse(tokens[text], tokens), background);
  const [high = 0, low = 0] = [luminance(foreground), luminance(background)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

const TEXT = 4.5;
const ICON = 3;

const PAIRS: [text: string, fill: string, surface: string, minimum: number][] = [
  ['foreground', 'background', 'background', TEXT],
  ['card-foreground', 'card', 'card', TEXT],
  ['muted-foreground', 'card', 'card', TEXT],
  ['primary-text', 'card', 'card', TEXT],
  ['primary-foreground', 'primary', 'card', TEXT],
  ['on-solid', 'primary', 'card', TEXT],
  ['on-solid-muted', 'primary', 'card', TEXT],
  ['destructive-foreground', 'destructive', 'card', TEXT],
  ['ghost-hover-foreground', 'ghost-hover', 'card', TEXT],
  ['chip-on-foreground', 'chip-on', 'card', TEXT],
  ['muted-foreground', 'chip', 'card', TEXT],
  ['status-good-foreground', 'status-good', 'card', TEXT],
  ['status-bad-foreground', 'status-bad', 'card', TEXT],
  ['badge-ai-foreground', 'badge-ai', 'card', TEXT],
  ['badge-voice-foreground', 'badge-voice', 'card', TEXT],
  ['badge-basic-foreground', 'badge-basic', 'card', TEXT],
  ['badge-edited-foreground', 'badge-edited', 'card', TEXT],
  ['toggle-on-foreground', 'toggle-on', 'card', ICON],
  ['done-foreground', 'done', 'card', ICON],
];

describe.each(Object.entries(THEMES))('%s theme', (_, tokens) => {
  it.each(PAIRS)('%s on %s over %s reads at %d:1 or more', (text, fill, surface, minimum) => {
    expect(contrast(text, fill, surface, tokens)).toBeGreaterThanOrEqual(minimum);
  });
});
