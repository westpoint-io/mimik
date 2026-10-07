// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  blobToBase64,
  blobToDataUrl,
  containFit,
  escapeHtml,
  extractDomain,
  fitImage,
  formatDate,
  stepContext,
} from '@/core/export/utils';
import type { Step } from '@/core/guides/types';

function makeStep(overrides: Partial<Step> = {}): Step {
  return {
    id: 'step-1',
    guideId: 'guide-1',
    index: 0,
    description: 'Click button',
    action: 'click',
    url: '',
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
  });

  it('escapes less-than', () => {
    expect(escapeHtml('a < b')).toBe('a &lt; b');
  });

  it('escapes greater-than', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('escapes multiple special characters in one string', () => {
    expect(escapeHtml('<div class="x">&</div>')).toBe('&lt;div class=&quot;x&quot;&gt;&amp;&lt;/div&gt;');
  });

  it('returns empty string unchanged', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('passes through strings with no special characters', () => {
    expect(escapeHtml('hello world 123')).toBe('hello world 123');
  });

  it('neutralizes script injection', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('neutralizes attribute injection via double quotes', () => {
    expect(escapeHtml('" onmouseover="alert(1)"')).toBe('&quot; onmouseover=&quot;alert(1)&quot;');
  });

  it('neutralizes img onerror payload', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  });

  it('neutralizes nested script tags', () => {
    expect(escapeHtml('<<script>>alert(1)<</script>>')).toBe('&lt;&lt;script&gt;&gt;alert(1)&lt;&lt;/script&gt;&gt;');
  });
});

describe('extractDomain', () => {
  it('returns the domain from the first step with a URL', () => {
    const steps = [
      makeStep({ url: 'https://www.example.com/page' }),
      makeStep({ id: 'step-2', url: 'https://other.com' }),
    ];
    expect(extractDomain(steps)).toBe('example.com');
  });

  it('strips www prefix', () => {
    const steps = [makeStep({ url: 'https://www.github.com/mimik' })];
    expect(extractDomain(steps)).toBe('github.com');
  });

  it('returns null for empty array', () => {
    expect(extractDomain([])).toBeNull();
  });

  it('returns null when no steps have URLs', () => {
    const steps = [makeStep({ url: '' }), makeStep({ id: 'step-2', url: '' })];
    expect(extractDomain(steps)).toBeNull();
  });

  it('skips steps without URLs and finds the first with one', () => {
    const steps = [makeStep({ url: '' }), makeStep({ id: 'step-2', url: 'https://docs.example.org/path' })];
    expect(extractDomain(steps)).toBe('docs.example.org');
  });
});

describe('formatDate', () => {
  it('returns a formatted date string', () => {
    const ts = new Date('2025-03-15T12:00:00Z').getTime();
    const result = formatDate(ts);
    expect(result).toContain('2025');
    expect(result).toContain('15');
  });
});

describe('blobToBase64', () => {
  it('resolves with base64 content from a blob', async () => {
    const blob = new Blob(['test'], { type: 'text/plain' });
    const result = await blobToBase64(blob);
    const decoded = atob(result);
    expect(decoded).toBe('test');
  });
});

describe('blobToDataUrl', () => {
  it('resolves with a data URL from a blob', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    const result = await blobToDataUrl(blob);
    expect(result).toMatch(/^data:text\/plain;base64,/);
    const b64Part = result.split(',')[1]!;
    expect(atob(b64Part)).toBe('hello');
  });
});

describe('fitImage', () => {
  it('leaves an image that already fits untouched', () => {
    expect(fitImage(103, 58, 211.5)).toEqual({ width: 103, height: 58 });
  });

  it('scales width down proportionally when the height exceeds the cap', () => {
    const fitted = fitImage(143, 300, 211.5);
    expect(fitted.height).toBe(211.5);
    expect(fitted.width).toBeCloseTo(143 * (211.5 / 300), 5);
    expect(fitted.width / fitted.height).toBeCloseTo(143 / 300, 5);
  });

  it('keeps a portrait phone screenshot inside the page at medium scale', () => {
    const width = 103;
    const height = (2436 / 1125) * width;
    const fitted = fitImage(width, height, 211.5);
    expect(height).toBeGreaterThan(211.5);
    expect(fitted.height).toBe(211.5);
    expect(fitted.width).toBeLessThan(width);
  });

  it('returns the input for a zero or non-finite height', () => {
    expect(fitImage(100, 0, 200)).toEqual({ width: 100, height: 0 });
    expect(fitImage(100, Number.NaN, 200)).toEqual({ width: 100, height: Number.NaN });
  });

  it('leaves an image exactly at the cap untouched', () => {
    expect(fitImage(143, 211.5, 211.5)).toEqual({ width: 143, height: 211.5 });
  });
});

describe('containFit', () => {
  it('fills the box exactly when the ratios match', () => {
    const fit = containFit(1600, 900, 143, 80.4375);
    expect(fit.width).toBeCloseTo(143, 4);
    expect(fit.height).toBeCloseTo(80.4375, 4);
    expect(fit.x).toBeCloseTo(0, 4);
    expect(fit.y).toBeCloseTo(0, 4);
  });

  it('pillarboxes a square inside a wide frame without exceeding it', () => {
    const fit = containFit(1000, 1000, 143, 80.4375);
    expect(fit.width).toBeCloseTo(80.4375, 4);
    expect(fit.height).toBeCloseTo(80.4375, 4);
    expect(fit.x).toBeCloseTo((143 - 80.4375) / 2, 4);
    expect(fit.y).toBeCloseTo(0, 4);
  });

  it('letterboxes a wide image inside a tall frame', () => {
    const fit = containFit(2000, 500, 100, 100);
    expect(fit.width).toBeCloseTo(100, 4);
    expect(fit.height).toBeCloseTo(25, 4);
    expect(fit.y).toBeCloseTo(37.5, 4);
  });

  it('preserves the source aspect ratio', () => {
    const fit = containFit(1366, 768, 143, 80.4375);
    expect(fit.width / fit.height).toBeCloseTo(1366 / 768, 6);
  });

  it('falls back to the box for a degenerate source', () => {
    expect(containFit(0, 0, 143, 80)).toEqual({ width: 143, height: 80, x: 0, y: 0 });
  });
});

describe('stepContext', () => {
  function step(overrides: Partial<Step>): Step {
    return {
      id: 's1',
      guideId: 'g1',
      index: 0,
      description: 'Do the thing',
      action: 'click',
      url: '',
      timestamp: 0,
      ...overrides,
    };
  }

  it('labels a browser step by host and path, and links it', () => {
    const ctx = stepContext(step({ url: 'https://www.example.com/settings/profile' }));
    expect(ctx).toEqual({ label: 'example.com/settings/profile', href: 'https://www.example.com/settings/profile' });
  });

  it('labels a desktop step by app and window, with nothing to link to', () => {
    const ctx = stepContext(step({ app: { name: 'Excel' }, window: { title: 'Budget.xlsx' } }));
    expect(ctx).toEqual({ label: 'Excel — Budget.xlsx' });
    expect(ctx?.href).toBeUndefined();
  });

  it('falls back to the app name when the window has no title', () => {
    expect(stepContext(step({ app: { name: 'Excel' }, window: { title: null } }))?.label).toBe('Excel');
  });

  it('returns nothing when a step has neither', () => {
    expect(stepContext(step({}))).toBeNull();
  });

  it('truncates at the limit the caller asks for', () => {
    const long = stepContext(step({ app: { name: 'A'.repeat(200) } }), 64);
    expect(long?.label).toHaveLength(64);
  });
});
