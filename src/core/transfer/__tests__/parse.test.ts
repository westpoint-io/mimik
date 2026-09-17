import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { readBundle } from '../parse';
import { BUNDLE_VERSION, type BundleError, MANIFEST_PATH, parseManifest } from '../schema';

function manifest(overrides: Record<string, unknown> = {}) {
  return {
    version: BUNDLE_VERSION,
    exportedAt: 1_700_000_000_000,
    guide: { title: 'Reset a password', createdAt: 1_700_000_000_000 },
    sourceDomain: 'app.example.com',
    redacted: { screenshots: true, inputValues: true, urls: 'path' },
    steps: [{ id: 'step-1', index: 0, description: 'Click save', action: 'click', url: '', timestamp: 1 }],
    screenshots: [
      {
        id: 'ss-1',
        stepId: 'step-1',
        file: 'screenshots/ss-1.webp',
        mimeType: 'image/webp',
        width: 800,
        height: 600,
      },
    ],
    ...overrides,
  };
}

function bundleFile(files: Record<string, Uint8Array>) {
  return new Blob([zipSync(files) as unknown as BlobPart]);
}

const caught = async (file: Blob): Promise<BundleError> => {
  try {
    await readBundle(file);
  } catch (err) {
    return err as BundleError;
  }
  throw new Error('expected readBundle to throw');
};

describe('parseManifest', () => {
  it('rejects a manifest from a newer Mimik rather than guessing at it', () => {
    expect(() => parseManifest(manifest({ version: BUNDLE_VERSION + 1 }))).toThrow(
      expect.objectContaining({ kind: 'unsupported-version' }),
    );
  });

  it('rejects a manifest with no usable steps', () => {
    expect(() => parseManifest(manifest({ steps: [{ noId: true }] }))).toThrow(
      expect.objectContaining({ kind: 'empty' }),
    );
  });

  it('rejects something that is not a manifest at all', () => {
    expect(() => parseManifest({ hello: 'world' })).toThrow(expect.objectContaining({ kind: 'not-a-bundle' }));
  });

  it('drops screenshot entries pointing outside the screenshots folder', () => {
    const parsed = parseManifest(
      manifest({
        screenshots: [
          { id: 'a', stepId: 'step-1', file: '../../etc/passwd', mimeType: 'image/webp', width: 1, height: 1 },
          { id: 'b', stepId: 'step-1', file: 'screenshots/ok.webp', mimeType: 'image/webp', width: 1, height: 1 },
        ],
      }),
    );
    expect(parsed.screenshots.map((s) => s.id)).toEqual(['b']);
  });

  it('drops screenshots whose step is not in the manifest', () => {
    const parsed = parseManifest(
      manifest({
        screenshots: [
          { id: 'a', stepId: 'ghost', file: 'screenshots/a.webp', mimeType: 'image/webp', width: 1, height: 1 },
        ],
      }),
    );
    expect(parsed.screenshots).toEqual([]);
  });

  it('drops malformed annotations instead of replaying a half-built redaction', () => {
    const parsed = parseManifest(
      manifest({
        screenshots: [
          {
            id: 'a',
            stepId: 'step-1',
            file: 'screenshots/a.webp',
            mimeType: 'image/webp',
            width: 1,
            height: 1,
            edits: {
              annotations: [
                { id: 'bad', type: 'redact', x: 1, y: 2 },
                { id: 'good', type: 'redact', x: 1, y: 2, w: 3, h: 4, style: 'blur' },
              ],
            },
          },
        ],
      }),
    );
    expect(parsed.screenshots[0].edits?.annotations?.map((a) => a.id)).toEqual(['good']);
  });

  it('rejects a traversal that starts inside the screenshots folder', () => {
    const parsed = parseManifest(
      manifest({
        screenshots: [
          {
            id: 'a',
            stepId: 'step-1',
            file: 'screenshots/../../evil.webp',
            mimeType: 'image/webp',
            width: 1,
            height: 1,
          },
          {
            id: 'b',
            stepId: 'step-1',
            file: 'screenshots\\..\\evil.webp',
            mimeType: 'image/webp',
            width: 1,
            height: 1,
          },
          { id: 'c', stepId: 'step-1', file: 'screenshots/ok.webp', mimeType: 'image/webp', width: 1, height: 1 },
        ],
      }),
    );
    expect(parsed.screenshots.map((s) => s.id)).toEqual(['c']);
  });

  it('refuses a mime type that is not an image', () => {
    const parsed = parseManifest(
      manifest({
        screenshots: [
          { id: 'a', stepId: 'step-1', file: 'screenshots/a.webp', mimeType: 'text/html', width: 1, height: 1 },
        ],
      }),
    );
    expect(parsed.screenshots[0].mimeType).toBe('image/webp');
  });

  it('drops a javascript: url rather than letting it reach an href', () => {
    const parsed = parseManifest(
      manifest({
        steps: [
          {
            id: 's',
            index: 0,
            description: 'x',
            action: 'click',
            url: 'javascript:fetch("https://evil.tld")',
            timestamp: 1,
            elementMeta: { tag: 'a', cssSelector: 'a', href: 'javascript:alert(1)' },
          },
        ],
      }),
    );
    expect(parsed.steps[0].url).toBe('');
    expect(parsed.steps[0].elementMeta?.href).toBeNull();
  });

  it('clamps absurd screenshot dimensions instead of sizing a canvas from them', () => {
    const parsed = parseManifest(
      manifest({
        screenshots: [
          { id: 'a', stepId: 'step-1', file: 'screenshots/a.webp', mimeType: 'image/webp', width: 5e9, height: 5e9 },
        ],
      }),
    );
    expect(parsed.screenshots[0].width).toBeLessThanOrEqual(32_768);
    expect(parsed.screenshots[0].height).toBeLessThanOrEqual(32_768);
  });

  it("enforces the manifest's own claim that typed values were stripped", () => {
    const parsed = parseManifest(
      manifest({
        redacted: { screenshots: false, inputValues: true, urls: 'path' },
        steps: [{ id: 's', index: 0, description: 'x', action: 'input', url: '', timestamp: 1, inputValue: 'hunter2' }],
      }),
    );
    expect(parsed.steps[0].inputValue).toBeUndefined();
  });

  it('keeps typed values when the bundle does not claim to have stripped them', () => {
    const parsed = parseManifest(
      manifest({
        redacted: { screenshots: false, inputValues: false, urls: 'full' },
        steps: [{ id: 's', index: 0, description: 'x', action: 'input', url: '', timestamp: 1, inputValue: 'hunter2' }],
      }),
    );
    expect(parsed.steps[0].inputValue).toBe('hunter2');
  });

  it('drops a text annotation with no size, which would compute NaN geometry', () => {
    const withAnnotations = (annotations: unknown[]) =>
      parseManifest(
        manifest({
          screenshots: [
            {
              id: 'a',
              stepId: 'step-1',
              file: 'screenshots/a.webp',
              mimeType: 'image/webp',
              width: 1,
              height: 1,
              edits: { annotations },
            },
          ],
        }),
      ).screenshots[0].edits?.annotations;

    expect(withAnnotations([{ id: 'bad', type: 'text', x: 1, y: 2, text: 'hi', color: '#000' }])).toBeUndefined();
    expect(
      withAnnotations([{ id: 'ok', type: 'text', x: 1, y: 2, text: 'hi', color: '#000', size: 32 }])?.map((a) => a.id),
    ).toEqual(['ok']);
    expect(withAnnotations([{ id: 'empty', type: 'freehand', points: [], color: '#000' }])).toBeUndefined();
    expect(withAnnotations([{ id: 'odd', type: 'freehand', points: [1, 2, 3], color: '#000' }])).toBeUndefined();
  });

  it('orders steps by their recorded index', () => {
    const parsed = parseManifest(
      manifest({
        steps: [
          { id: 'b', index: 1, description: 'second', action: 'click', url: '', timestamp: 2 },
          { id: 'a', index: 0, description: 'first', action: 'click', url: '', timestamp: 1 },
        ],
      }),
    );
    expect(parsed.steps.map((s) => s.id)).toEqual(['a', 'b']);
  });
});

describe('readBundle', () => {
  it('pairs each manifest screenshot with its image', async () => {
    const file = bundleFile({
      [MANIFEST_PATH]: strToU8(JSON.stringify(manifest())),
      'screenshots/ss-1.webp': strToU8('pixels'),
    });

    const { manifest: parsed, images } = await readBundle(file);
    expect(parsed.guide.title).toBe('Reset a password');
    expect(images.get('screenshots/ss-1.webp')).toBeInstanceOf(Blob);
  });

  it('tolerates a manifest pointing at an image the archive does not have', async () => {
    const { images } = await readBundle(bundleFile({ [MANIFEST_PATH]: strToU8(JSON.stringify(manifest())) }));
    expect(images.size).toBe(0);
  });

  it('reports a file that is not a zip', async () => {
    expect((await caught(new Blob(['just some text']))).kind).toBe('unreadable');
  });

  it('reports a zip with no manifest', async () => {
    expect((await caught(bundleFile({ 'readme.txt': strToU8('hi') }))).kind).toBe('not-a-bundle');
  });

  it('refuses a zip bomb before inflating it', async () => {
    const huge = new Uint8Array(210 * 1024 * 1024);
    const bomb = bundleFile({ [MANIFEST_PATH]: strToU8(JSON.stringify(manifest())), 'screenshots/big.webp': huge });
    expect(bomb.size).toBeLessThan(5 * 1024 * 1024);
    expect((await caught(bomb)).kind).toBe('unreadable');
  });

  it('reports a manifest that is not valid JSON', async () => {
    expect((await caught(bundleFile({ [MANIFEST_PATH]: strToU8('{ nope') }))).kind).toBe('not-a-bundle');
  });
});
