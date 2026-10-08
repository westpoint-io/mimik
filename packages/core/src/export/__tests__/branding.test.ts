import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DEFAULT_BRAND_COLOR, dataUrlToBytes, defaultFooterLine, fitLogo, loadBranding } from '@/core/export/branding';
import { DEFAULT_TARGET_COLOR } from '@/core/screenshot/types';

describe('loadBranding', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('no packaged asset in tests'))),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prefills the footer and defaults the accent when storage is empty', async () => {
    const brand = await loadBranding();
    expect(brand).toEqual({
      logo: null,
      footer: defaultFooterLine(),
      attribution: true,
      accent: DEFAULT_BRAND_COLOR,
      custom: false,
    });
  });

  it('respects a footer the user has deliberately cleared', async () => {
    await fakeBrowser.storage.local.set({ brandFooter: '' });
    expect((await loadBranding()).footer).toBe('');
  });

  it('normalises a shorthand accent and flags it as custom', async () => {
    await fakeBrowser.storage.local.set({ targetColor: '#f43' });
    const brand = await loadBranding();
    expect(brand.accent).toBe('#FF4433');
    expect(brand.custom).toBe(true);
  });

  it('ignores an unparseable accent rather than emitting it into the document', async () => {
    await fakeBrowser.storage.local.set({ targetColor: 'not-a-colour' });
    const brand = await loadBranding();
    expect(brand.accent).toBe(DEFAULT_BRAND_COLOR);
    expect(brand.custom).toBe(false);
  });

  it('gives exports the navy brand color when only the default click highlight was saved', async () => {
    await fakeBrowser.storage.local.set({ targetColor: DEFAULT_TARGET_COLOR.toLowerCase() });
    const brand = await loadBranding();
    expect(brand.accent).toBe(DEFAULT_BRAND_COLOR);
    expect(brand.custom).toBe(false);
  });

  it('uses the brand color over the click highlight once one is saved', async () => {
    await fakeBrowser.storage.local.set({ targetColor: '#F43F5E', brandColor: '#14b8a6' });
    expect((await loadBranding()).accent).toBe('#14B8A6');
  });

  it('trims the footer line and keeps attribution on unless explicitly disabled', async () => {
    await fakeBrowser.storage.local.set({ brandFooter: '  Confidential  ' });
    expect((await loadBranding()).footer).toBe('Confidential');
    expect((await loadBranding()).attribution).toBe(true);

    await fakeBrowser.storage.local.set({ brandAttribution: false });
    expect((await loadBranding()).attribution).toBe(false);
  });

  it('rejects a malformed stored logo instead of rendering a broken image', async () => {
    for (const brandLogo of [
      { dataUrl: 'https://example.com/logo.png', width: 10, height: 10 },
      { dataUrl: 'data:image/png;base64,AAA', width: 0, height: 10 },
      { dataUrl: 'data:image/png;base64,AAA' },
      'not-an-object',
    ]) {
      await fakeBrowser.storage.local.set({ brandLogo });
      expect((await loadBranding()).logo).toBeNull();
    }
  });

  it('accepts a well-formed stored logo and does not reach for the Mimik fallback', async () => {
    const brandLogo = { dataUrl: 'data:image/png;base64,AAA', width: 320, height: 80 };
    await fakeBrowser.storage.local.set({ brandLogo });
    expect((await loadBranding()).logo).toEqual(brandLogo);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reaches for the packaged Mimik fallback when no logo is stored', async () => {
    await loadBranding();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fetch).mock.calls[0]![0])).toContain('mimik-mark.png');
  });
});

describe('fitLogo', () => {
  it('scales down to fit the tighter of the two bounds', () => {
    expect(fitLogo({ dataUrl: 'x', width: 400, height: 100 }, 200, 80)).toEqual({ width: 200, height: 50 });
    expect(fitLogo({ dataUrl: 'x', width: 100, height: 400 }, 200, 80)).toEqual({ width: 20, height: 80 });
  });

  it('never upscales a small logo', () => {
    expect(fitLogo({ dataUrl: 'x', width: 40, height: 20 }, 200, 80)).toEqual({ width: 40, height: 20 });
  });
});

describe('dataUrlToBytes', () => {
  it('decodes the base64 payload after the comma', () => {
    const dataUrl = `data:image/png;base64,${btoa('PNG-ish')}`;
    expect(new TextDecoder().decode(dataUrlToBytes(dataUrl))).toBe('PNG-ish');
  });
});
