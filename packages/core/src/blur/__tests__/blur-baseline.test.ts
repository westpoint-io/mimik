// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { type PresetKey, patternsFor, sensitiveSpans } from '../patterns';
import { PageRedactor } from '../redactor';
import { fuzzSamples, PAGES, SAMPLES, shapedSamples } from './blur-corpus';

const KINDS: PresetKey[] = ['email', 'phone', 'ssn', 'creditCard', 'ipAddress', 'macAddress'];
const BLURRED = '[data-mimik-redact]';

const ranges = (text: string, kinds: PresetKey[]) =>
  sensitiveSpans(text, patternsFor(kinds))
    .map((range) => `${range.start}-${range.end}`)
    .join(',');

const record = (text: string) => [text, ...KINDS.map((kind) => ranges(text, [kind])), ranges(text, KINDS)];

describe('smart blur keeps blurring exactly what it blurred before the rewrite', () => {
  it('matches the same ranges on the hand-written samples', async () => {
    await expect(JSON.stringify(SAMPLES.map(record), null, 1)).toMatchFileSnapshot('./__snapshots__/blur-samples.json');
  });

  it('matches the same ranges on 4000 generated strings', async () => {
    await expect(JSON.stringify(fuzzSamples(4000, 7).map(record))).toMatchFileSnapshot(
      './__snapshots__/blur-fuzz.json',
    );
  });

  it('matches the same ranges on 8000 strings built from near-matches', async () => {
    await expect(JSON.stringify(shapedSamples(8000, 11).map(record))).toMatchFileSnapshot(
      './__snapshots__/blur-shaped.json',
    );
  });

  it('blurs the same text and fields on whole pages', async () => {
    const pages = PAGES.flatMap((html) =>
      [['email'], KINDS].map((kinds) => {
        document.body.innerHTML = html;
        const scanner = new PageRedactor();
        scanner.start(kinds as PresetKey[]);
        scanner.detach();
        const blurred = [...document.querySelectorAll<HTMLElement>(BLURRED)].map((node) =>
          node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement
            ? `field:${node.value}`
            : `text:${node.textContent}`,
        );
        scanner.stop();
        const restored = document.body.innerHTML === html;
        return { html, kinds: kinds.length, blurred, restored };
      }),
    );
    await expect(JSON.stringify(pages, null, 1)).toMatchFileSnapshot('./__snapshots__/blur-pages.json');
  });
});
