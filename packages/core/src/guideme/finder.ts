import type { ElementMeta } from '@/core/guides/types';

interface FindResult {
  element: HTMLElement | null;
  score: number;
  matchDetails: Record<string, number>;
}

const THRESHOLD = 0.5;

const WEIGHTS: Record<string, number> = {
  textContent: 0.3,
  cssSelector: 0.2,
  ariaLabel: 0.15,
  dataTestId: 0.1,
  name: 0.08,
  placeholder: 0.07,
  role: 0.05,
  href: 0.05,
};

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function compareText(stored: string, candidate: string): number {
  if (stored === candidate) return 1.0;
  const a = normalize(stored);
  const b = normalize(candidate);
  if (a === b) return 0.8;
  if (a.startsWith(b) || b.startsWith(a)) return 0.6;
  return 0;
}

function isVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getCandidateValue(el: HTMLElement, signal: string): string | null {
  switch (signal) {
    case 'textContent':
      return el.textContent?.trim().slice(0, 200) || null;
    case 'ariaLabel':
      return el.getAttribute('aria-label');
    case 'dataTestId':
      return el.getAttribute('data-testid') || el.getAttribute('data-test-id') || el.getAttribute('data-qa');
    case 'name':
      return el.getAttribute('name');
    case 'placeholder':
      return el.getAttribute('placeholder');
    case 'role':
      return el.getAttribute('role') || el.tagName?.toLowerCase() || null;
    case 'href':
      return el instanceof HTMLAnchorElement ? el.href : null;
    default:
      return null;
  }
}

function scoreCssSelector(meta: ElementMeta, candidate: HTMLElement): number {
  if (!meta.cssSelector) return 0;
  try {
    const matched = document.querySelector(meta.cssSelector);
    return matched === candidate ? 1 : 0;
  } catch {
    return 0;
  }
}

function scoreCandidate(
  meta: ElementMeta,
  candidate: HTMLElement,
): { score: number; matchDetails: Record<string, number> } {
  const activeSignals: { key: string; weight: number }[] = [];

  for (const [key, weight] of Object.entries(WEIGHTS)) {
    if (key === 'cssSelector') {
      if (meta.cssSelector) activeSignals.push({ key, weight });
      continue;
    }
    const storedValue = meta[key as keyof ElementMeta];
    if (storedValue != null && storedValue !== '') {
      activeSignals.push({ key, weight });
    }
  }

  if (activeSignals.length === 0) {
    return { score: 0, matchDetails: {} };
  }

  const totalWeight = activeSignals.reduce((sum, s) => sum + s.weight, 0);
  const matchDetails: Record<string, number> = {};
  let score = 0;

  for (const { key, weight } of activeSignals) {
    const normalizedWeight = weight / totalWeight;
    let signalScore = 0;

    if (key === 'cssSelector') {
      signalScore = scoreCssSelector(meta, candidate);
    } else {
      const storedValue = meta[key as keyof ElementMeta] as string;
      const candidateValue = getCandidateValue(candidate, key);
      if (candidateValue) {
        signalScore = compareText(storedValue, candidateValue);
      }
    }

    matchDetails[key] = signalScore;
    score += signalScore * normalizedWeight;
  }

  return { score, matchDetails };
}

function findElement(meta: ElementMeta): FindResult {
  const candidates = document.querySelectorAll<HTMLElement>(meta.tag ?? '*');
  let bestResult: FindResult = { element: null, score: 0, matchDetails: {} };

  for (const candidate of candidates) {
    if (!isVisible(candidate)) continue;

    const { score, matchDetails } = scoreCandidate(meta, candidate);
    if (score > bestResult.score) {
      bestResult = { element: candidate, score, matchDetails };
    }
  }

  if (bestResult.score < THRESHOLD) {
    return { element: null, score: bestResult.score, matchDetails: bestResult.matchDetails };
  }

  return bestResult;
}

export { compareText, findElement, isVisible, scoreCandidate, THRESHOLD, WEIGHTS };
