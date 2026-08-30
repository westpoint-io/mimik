export type PresetKey =
  | 'email'
  | 'phone'
  | 'ssn'
  | 'creditCard'
  | 'ipAddress'
  | 'macAddress'
  | 'ukPhone'
  | 'ukPostcode'
  | 'ukNino'
  | 'ukSortCode';

export const PRESET_REGEXES: Record<PresetKey, RegExp> = {
  email: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
  creditCard: /\b(?:\d[ -]*?){13,19}\b/g,
  phone: /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{4}\b/g,
  ipAddress: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
  macAddress: /\b[0-9A-F]{2}(?:[:-][0-9A-F]{2}){5}\b/gi,
  ukPhone: /(?<!\d)(?:\+44[\s-]?(?:\(0\)[\s-]?)?\d{2,4}|\(?0\d{2,4}\)?)[\s-]?\d{3,4}[\s-]?\d{3,4}\b/g,
  ukPostcode: /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/gi,
  ukNino: /\b[A-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/gi,
  ukSortCode: /(?<!\d)\d{2}-\d{2}-\d{2}(?!\d)/g,
};

export const PRESET_LABELS: Record<PresetKey, string> = {
  email: 'Email',
  phone: 'Phone Numbers',
  ssn: 'SSN',
  creditCard: 'Credit Card',
  ipAddress: 'IP Address',
  macAddress: 'MAC Address',
  ukPhone: 'UK Phone Numbers',
  ukPostcode: 'UK Postcode',
  ukNino: 'National Insurance Number',
  ukSortCode: 'UK Sort Code',
};

export interface MatchRange {
  start: number;
  end: number;
}

export function findMatches(text: string, patterns: RegExp[]): MatchRange[] {
  const ranges: MatchRange[] = [];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match = pattern.exec(text);
    while (match !== null) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
      match = pattern.exec(text);
    }
  }
  ranges.sort((a, b) => a.start - b.start);
  const merged: MatchRange[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}
