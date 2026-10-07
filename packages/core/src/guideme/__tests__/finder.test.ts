// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import type { ElementMeta } from '@/core/guides/types';
import { compareText, findElement, isVisible, scoreCandidate, THRESHOLD, WEIGHTS } from '../finder';

function makeMeta(overrides: Partial<ElementMeta> = {}): ElementMeta {
  return {
    tag: 'button',
    cssSelector: 'button.submit',
    textContent: null,
    ariaLabel: null,
    placeholder: null,
    altText: null,
    name: null,
    role: null,
    href: null,
    inputType: null,
    dataTestId: null,
    rect: { x: 0, y: 0, width: 100, height: 40 },
    devicePixelRatio: 1,
    ...overrides,
  };
}

function makeVisible(el: HTMLElement): HTMLElement {
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({ x: 0, y: 0, width: 100, height: 40, top: 0, left: 0, right: 100, bottom: 40 }),
  });
  return el;
}

function makeHidden(el: HTMLElement): HTMLElement {
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }),
  });
  return el;
}

describe('WEIGHTS', () => {
  it('has textContent as the highest weight', () => {
    const sorted = Object.entries(WEIGHTS).sort(([, a], [, b]) => b - a);
    expect(sorted[0]![0]).toBe('textContent');
  });

  it('ranks cssSelector second', () => {
    const sorted = Object.entries(WEIGHTS).sort(([, a], [, b]) => b - a);
    expect(sorted[1]![0]).toBe('cssSelector');
  });

  it('ranks ariaLabel third', () => {
    const sorted = Object.entries(WEIGHTS).sort(([, a], [, b]) => b - a);
    expect(sorted[2]![0]).toBe('ariaLabel');
  });

  it('has correct weight values', () => {
    expect(WEIGHTS.textContent).toBe(0.3);
    expect(WEIGHTS.cssSelector).toBe(0.2);
    expect(WEIGHTS.ariaLabel).toBe(0.15);
    expect(WEIGHTS.dataTestId).toBe(0.1);
    expect(WEIGHTS.name).toBe(0.08);
    expect(WEIGHTS.placeholder).toBe(0.07);
    expect(WEIGHTS.role).toBe(0.05);
    expect(WEIGHTS.href).toBe(0.05);
  });
});

describe('THRESHOLD', () => {
  it('is 0.5', () => {
    expect(THRESHOLD).toBe(0.5);
  });
});

describe('compareText', () => {
  it('returns 1.0 for exact match', () => {
    expect(compareText('Submit', 'Submit')).toBe(1.0);
  });

  it('returns 0.8 for normalized match (case difference)', () => {
    expect(compareText('Submit', 'submit')).toBe(0.8);
  });

  it('returns 0.8 for normalized match (extra whitespace)', () => {
    expect(compareText('  Submit  Form  ', 'submit form')).toBe(0.8);
  });

  it('returns 0.6 when stored starts with candidate (prefix match)', () => {
    expect(compareText('Submit Form Now', 'submit form')).toBe(0.6);
  });

  it('returns 0.6 when candidate starts with stored (prefix match)', () => {
    expect(compareText('submit', 'submit form now')).toBe(0.6);
  });

  it('returns 0 for completely different strings', () => {
    expect(compareText('Submit', 'Cancel')).toBe(0);
  });

  it('returns 0 for partial but non-prefix overlap', () => {
    expect(compareText('Submit Form', 'The Form')).toBe(0);
  });
});

describe('isVisible', () => {
  it('returns true for elements with positive dimensions', () => {
    const el = makeVisible(document.createElement('div'));
    expect(isVisible(el)).toBe(true);
  });

  it('returns false for elements with zero width', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ x: 0, y: 0, width: 0, height: 40, top: 0, left: 0, right: 0, bottom: 40 }),
    });
    expect(isVisible(el)).toBe(false);
  });

  it('returns false for elements with zero height', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ x: 0, y: 0, width: 100, height: 0, top: 0, left: 0, right: 100, bottom: 0 }),
    });
    expect(isVisible(el)).toBe(false);
  });
});

describe('scoreCandidate', () => {
  it('still includes cssSelector as active signal even when all others are null', () => {
    const meta = makeMeta({
      textContent: null,
      ariaLabel: null,
      dataTestId: null,
      name: null,
      placeholder: null,
      role: null,
      href: null,
    });

    const el = document.createElement('button');
    const { score, matchDetails } = scoreCandidate(meta, el);

    expect(matchDetails).not.toHaveProperty('textContent');
    expect(matchDetails).not.toHaveProperty('ariaLabel');
    expect(matchDetails).toHaveProperty('cssSelector');
    expect(score).toBe(0);
  });

  it('gives full score when cssSelector matches and is only active signal', () => {
    const btn = makeVisible(document.createElement('button'));
    btn.className = 'submit';
    document.body.appendChild(btn);

    const meta = makeMeta({
      cssSelector: 'button.submit',
      textContent: null,
      ariaLabel: null,
      dataTestId: null,
      name: null,
      placeholder: null,
      role: null,
      href: null,
    });

    const { score, matchDetails } = scoreCandidate(meta, btn);

    expect(matchDetails.cssSelector).toBe(1);
    expect(score).toBe(1);

    document.body.removeChild(btn);
  });

  it('scores textContent exact match with correct weight proportion', () => {
    const btn = document.createElement('button');
    btn.textContent = 'Save Changes';

    const meta = makeMeta({
      textContent: 'Save Changes',
      cssSelector: '#nonexistent',
    });

    const { matchDetails } = scoreCandidate(meta, btn);
    expect(matchDetails.textContent).toBe(1.0);
    expect(matchDetails.cssSelector).toBe(0);
  });

  it('scores ariaLabel match', () => {
    const btn = document.createElement('button');
    btn.setAttribute('aria-label', 'Close dialog');

    const meta = makeMeta({
      ariaLabel: 'Close dialog',
      textContent: null,
      cssSelector: '#nonexistent',
    });

    const { matchDetails } = scoreCandidate(meta, btn);
    expect(matchDetails.ariaLabel).toBe(1.0);
  });

  it('scores dataTestId from data-testid attribute', () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'submit-btn');

    const meta = makeMeta({
      dataTestId: 'submit-btn',
      textContent: null,
      cssSelector: '#nonexistent',
    });

    const { matchDetails } = scoreCandidate(meta, btn);
    expect(matchDetails.dataTestId).toBe(1.0);
  });

  it('scores dataTestId from data-test-id attribute', () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-test-id', 'submit-btn');

    const meta = makeMeta({
      dataTestId: 'submit-btn',
      textContent: null,
      cssSelector: '#nonexistent',
    });

    const { matchDetails } = scoreCandidate(meta, btn);
    expect(matchDetails.dataTestId).toBe(1.0);
  });

  it('scores dataTestId from data-qa attribute', () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-qa', 'submit-btn');

    const meta = makeMeta({
      dataTestId: 'submit-btn',
      textContent: null,
      cssSelector: '#nonexistent',
    });

    const { matchDetails } = scoreCandidate(meta, btn);
    expect(matchDetails.dataTestId).toBe(1.0);
  });

  it('scores name attribute', () => {
    const input = document.createElement('input');
    input.setAttribute('name', 'email');

    const meta = makeMeta({
      tag: 'input',
      name: 'email',
      textContent: null,
      cssSelector: '#nonexistent',
    });

    const { matchDetails } = scoreCandidate(meta, input);
    expect(matchDetails.name).toBe(1.0);
  });

  it('scores placeholder attribute', () => {
    const input = document.createElement('input');
    input.setAttribute('placeholder', 'Enter email');

    const meta = makeMeta({
      tag: 'input',
      placeholder: 'Enter email',
      textContent: null,
      cssSelector: '#nonexistent',
    });

    const { matchDetails } = scoreCandidate(meta, input);
    expect(matchDetails.placeholder).toBe(1.0);
  });

  it('scores role attribute', () => {
    const div = document.createElement('div');
    div.setAttribute('role', 'button');

    const meta = makeMeta({
      tag: 'div',
      role: 'button',
      textContent: null,
      cssSelector: '#nonexistent',
    });

    const { matchDetails } = scoreCandidate(meta, div);
    expect(matchDetails.role).toBe(1.0);
  });

  it('falls back to tagName for role when no role attribute', () => {
    const btn = document.createElement('button');

    const meta = makeMeta({
      role: 'button',
      textContent: null,
      cssSelector: '#nonexistent',
    });

    const { matchDetails } = scoreCandidate(meta, btn);
    expect(matchDetails.role).toBe(1.0);
  });

  it('scores href for anchor elements', () => {
    const a = document.createElement('a');
    a.href = 'https://example.com/page';

    const meta = makeMeta({
      tag: 'a',
      href: 'https://example.com/page',
      textContent: null,
      cssSelector: '#nonexistent',
    });

    const { matchDetails } = scoreCandidate(meta, a);
    expect(matchDetails.href).toBeGreaterThan(0);
  });

  it('returns 0 for href on non-anchor elements', () => {
    const btn = document.createElement('button');

    const meta = makeMeta({
      href: 'https://example.com',
      textContent: null,
      cssSelector: '#nonexistent',
    });

    const { matchDetails } = scoreCandidate(meta, btn);
    expect(matchDetails.href).toBe(0);
  });

  it('normalizes weights to sum to 1', () => {
    const btn = document.createElement('button');
    btn.textContent = 'Submit';
    btn.setAttribute('aria-label', 'Submit form');

    const meta = makeMeta({
      textContent: 'Submit',
      ariaLabel: 'Submit form',
      cssSelector: '#nonexistent',
    });

    const { score, matchDetails } = scoreCandidate(meta, btn);

    const totalWeight = WEIGHTS.textContent! + WEIGHTS.ariaLabel! + WEIGHTS.cssSelector!;
    const expected =
      (matchDetails.textContent! * WEIGHTS.textContent! +
        matchDetails.ariaLabel! * WEIGHTS.ariaLabel! +
        matchDetails.cssSelector! * WEIGHTS.cssSelector!) /
      totalWeight;

    expect(score).toBeCloseTo(expected, 10);
  });

  it('returns high score when all signals match exactly', () => {
    const btn = makeVisible(document.createElement('button'));
    btn.className = 'all-match';
    btn.textContent = 'Save';
    btn.setAttribute('aria-label', 'Save document');
    btn.setAttribute('data-testid', 'save-btn');
    btn.setAttribute('name', 'save');
    btn.setAttribute('placeholder', 'save');
    btn.setAttribute('role', 'button');
    document.body.appendChild(btn);

    const meta = makeMeta({
      cssSelector: 'button.all-match',
      textContent: 'Save',
      ariaLabel: 'Save document',
      dataTestId: 'save-btn',
      name: 'save',
      placeholder: 'save',
      role: 'button',
    });

    const { score } = scoreCandidate(meta, btn);
    expect(score).toBe(1.0);

    document.body.removeChild(btn);
  });

  it('gives partial score for normalized text matches', () => {
    const btn = document.createElement('button');
    btn.textContent = '  save  changes  ';

    const meta = makeMeta({
      textContent: 'Save Changes',
      cssSelector: '#nonexistent',
    });

    const { matchDetails } = scoreCandidate(meta, btn);
    expect(matchDetails.textContent).toBe(0.8);
  });

  it('gives partial score for prefix text matches', () => {
    const btn = document.createElement('button');
    btn.textContent = 'Save';

    const meta = makeMeta({
      textContent: 'Save Changes Now',
      cssSelector: '#nonexistent',
    });

    const { matchDetails } = scoreCandidate(meta, btn);
    expect(matchDetails.textContent).toBe(0.6);
  });

  it('handles invalid cssSelector gracefully', () => {
    const btn = document.createElement('button');
    const meta = makeMeta({
      cssSelector: '[[[invalid',
      textContent: 'Click me',
    });

    const { matchDetails } = scoreCandidate(meta, btn);
    expect(matchDetails.cssSelector).toBe(0);
  });
});

describe('findElement', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns the best matching element above threshold', () => {
    const target = makeVisible(document.createElement('button'));
    target.textContent = 'Submit Form';
    target.setAttribute('data-testid', 'submit');
    document.body.appendChild(target);

    const decoy = makeVisible(document.createElement('button'));
    decoy.textContent = 'Cancel';
    document.body.appendChild(decoy);

    const meta = makeMeta({
      tag: 'button',
      textContent: 'Submit Form',
      dataTestId: 'submit',
      cssSelector: '#nonexistent',
    });

    const result = findElement(meta);
    expect(result.element).toBe(target);
    expect(result.score).toBeGreaterThanOrEqual(THRESHOLD);
  });

  it('returns null when no element exceeds threshold', () => {
    const btn = makeVisible(document.createElement('button'));
    btn.textContent = 'Completely Different';
    document.body.appendChild(btn);

    const meta = makeMeta({
      tag: 'button',
      textContent: 'Submit Form',
      ariaLabel: 'Submit the form',
      dataTestId: 'submit-btn',
      cssSelector: '#nonexistent',
    });

    const result = findElement(meta);
    expect(result.element).toBeNull();
    expect(result.score).toBeLessThan(THRESHOLD);
  });

  it('returns null when no candidates exist for the tag', () => {
    const meta = makeMeta({ tag: 'button' });
    const result = findElement(meta);
    expect(result.element).toBeNull();
  });

  it('skips hidden elements', () => {
    const hidden = makeHidden(document.createElement('button'));
    hidden.textContent = 'Submit';
    hidden.setAttribute('data-testid', 'submit');
    document.body.appendChild(hidden);

    const visible = makeVisible(document.createElement('button'));
    visible.textContent = 'Submit';
    visible.setAttribute('data-testid', 'submit');
    document.body.appendChild(visible);

    const meta = makeMeta({
      tag: 'button',
      textContent: 'Submit',
      dataTestId: 'submit',
      cssSelector: '#nonexistent',
    });

    const result = findElement(meta);
    expect(result.element).toBe(visible);
  });

  it('returns null when all matching elements are hidden', () => {
    const hidden = makeHidden(document.createElement('button'));
    hidden.textContent = 'Submit';
    hidden.setAttribute('data-testid', 'submit');
    document.body.appendChild(hidden);

    const meta = makeMeta({
      tag: 'button',
      textContent: 'Submit',
      dataTestId: 'submit',
      cssSelector: '#nonexistent',
    });

    const result = findElement(meta);
    expect(result.element).toBeNull();
  });

  it('picks the highest scoring element among multiple visible candidates', () => {
    const weak = makeVisible(document.createElement('button'));
    weak.textContent = 'Sub';
    document.body.appendChild(weak);

    const strong = makeVisible(document.createElement('button'));
    strong.textContent = 'Submit';
    strong.setAttribute('aria-label', 'Submit form');
    strong.setAttribute('data-testid', 'submit-btn');
    document.body.appendChild(strong);

    const meta = makeMeta({
      tag: 'button',
      textContent: 'Submit',
      ariaLabel: 'Submit form',
      dataTestId: 'submit-btn',
      cssSelector: '#nonexistent',
    });

    const result = findElement(meta);
    expect(result.element).toBe(strong);
  });

  it('includes matchDetails in the result', () => {
    const btn = makeVisible(document.createElement('button'));
    btn.textContent = 'OK';
    document.body.appendChild(btn);

    const meta = makeMeta({
      tag: 'button',
      textContent: 'OK',
      cssSelector: '#nonexistent',
    });

    const result = findElement(meta);
    expect(result.matchDetails).toBeDefined();
    expect(typeof result.matchDetails.textContent).toBe('number');
    expect(typeof result.matchDetails.cssSelector).toBe('number');
  });

  it('returns score below threshold in result when no match', () => {
    const btn = makeVisible(document.createElement('button'));
    btn.textContent = 'Nope';
    document.body.appendChild(btn);

    const meta = makeMeta({
      tag: 'button',
      textContent: 'Totally different text here',
      ariaLabel: 'Something else entirely',
      dataTestId: 'other-btn',
      cssSelector: '#nonexistent',
    });

    const result = findElement(meta);
    expect(result.element).toBeNull();
    expect(result.score).toBe(0);
    expect(result.matchDetails).toBeDefined();
  });

  it('uses cssSelector match via querySelector', () => {
    const btn = makeVisible(document.createElement('button'));
    btn.id = 'unique-submit';
    btn.textContent = 'Go';
    document.body.appendChild(btn);

    const meta = makeMeta({
      tag: 'button',
      cssSelector: '#unique-submit',
      textContent: 'Go',
    });

    const result = findElement(meta);
    expect(result.element).toBe(btn);
    expect(result.matchDetails.cssSelector).toBe(1);
  });
});
