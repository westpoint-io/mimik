export type PresetKey = 'email' | 'phone' | 'ssn' | 'creditCard' | 'ipAddress' | 'macAddress';

export const PRESET_LABELS: Record<PresetKey, string> = {
  email: 'Email',
  phone: 'Phone Numbers',
  ssn: 'SSN',
  creditCard: 'Credit Card',
  ipAddress: 'IP Address',
  macAddress: 'MAC Address',
};

export const DEFAULT_PRESETS: Record<PresetKey, boolean> = {
  email: true,
  phone: true,
  ssn: false,
  creditCard: false,
  ipAddress: false,
  macAddress: false,
};

const OCTET = String.raw`(?:25[0-5]|2[0-4]\d|[01]\d\d|\d\d?)`;
const GAP = String.raw`[\s.-]?`;
const PHONE_SHAPES = [
  String.raw`\+\d{1,3}${GAP}\d{2,5}${GAP}\d{3,4}${GAP}\d{3,4}`,
  String.raw`\b0\d{1,4}${GAP}\d{3,4}${GAP}\d{3,4}`,
  String.raw`\(\d{3}\)${GAP}\d{3}${GAP}\d{4}`,
  String.raw`\b\d{3}[\s.-]\d{3}[\s.-]\d{4}`,
  String.raw`\b\d{10,11}`,
];

const SHAPES: Record<PresetKey, { source: string; caseless?: true }> = {
  email: { source: String.raw`\b[\w.%+-]+@[a-z\d.-]+\.[a-z]{2,}\b`, caseless: true },
  phone: { source: `(?:${PHONE_SHAPES.join('|')})\\b` },
  ssn: { source: String.raw`\b\d\d\d-?\d\d-?\d\d\d\d\b` },
  creditCard: { source: String.raw`\b\d(?:[ -]*?\d){12}\d{0,6}\b` },
  ipAddress: { source: String.raw`\b(?:${OCTET}\.){3}${OCTET}\b` },
  macAddress: { source: String.raw`\b[\da-f]{2}(?:[-:][\da-f]{2}){5}\b`, caseless: true },
};

export function patternsFor(kinds: readonly PresetKey[]): RegExp[] {
  return kinds
    .filter((kind) => kind in SHAPES)
    .map((kind) => new RegExp(SHAPES[kind].source, SHAPES[kind].caseless ? 'gi' : 'g'));
}

export interface TextSpan {
  start: number;
  end: number;
}

export function sensitiveSpans(text: string, patterns: readonly RegExp[]): TextSpan[] {
  const hits = patterns.flatMap((pattern) =>
    Array.from(
      text.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)),
      (hit) => ({
        start: hit.index,
        end: hit.index + hit[0].length,
      }),
    ),
  );
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const joined: TextSpan[] = [];
  for (const hit of hits) {
    const open = joined.at(-1);
    if (open && hit.start <= open.end) open.end = Math.max(open.end, hit.end);
    else joined.push({ ...hit });
  }
  return joined;
}
