export interface Hsv {
  h: number;
  s: number;
  v: number;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function normalizeHex(value: string): string | null {
  const raw = value.trim().replace(/^#/, '');
  const full = raw.length === 3 ? [...raw].map((c) => c + c).join('') : raw;
  return /^[0-9a-fA-F]{6}$/.test(full) ? `#${full.toUpperCase()}` : null;
}

export function hexToRgb(hex: string): [number, number, number] | null {
  const norm = normalizeHex(hex);
  if (!norm) return null;
  const n = Number.parseInt(norm.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const part = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

export function hexToHsv(hex: string): Hsv {
  const rgb = hexToRgb(hex);
  if (!rgb) return { h: 0, s: 0, v: 0 };
  const [r, g, b] = rgb.map((c) => c / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s: max ? d / max : 0, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const c = (((h % 360) + 360) % 360) / 60;
  const f = v * clamp01(s);
  const x = f * (1 - Math.abs((c % 2) - 1));
  const m = v - f;
  const table: [number, number, number][] = [
    [f, x, 0],
    [x, f, 0],
    [0, f, x],
    [0, x, f],
    [x, 0, f],
    [f, 0, x],
  ];
  const [r, g, b] = table[Math.floor(c) % 6]!;
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

export function shadeOf(hex: string, valueScale: number, saturationScale = 1): string {
  const hsv = hexToHsv(hex);
  return hsvToHex({ h: hsv.h, s: clamp01(hsv.s * saturationScale), v: clamp01(hsv.v * valueScale) });
}
