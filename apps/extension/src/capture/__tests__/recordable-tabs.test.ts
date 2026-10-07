import { describe, expect, it } from 'vitest';
import { isRecordableUrl } from '@/capture/recordable-tabs';

describe('isRecordableUrl', () => {
  it('accepts http and https pages', () => {
    expect(isRecordableUrl('https://example.test/path')).toBe(true);
    expect(isRecordableUrl('http://localhost:3000')).toBe(true);
  });

  it('rejects pages no content script can reach', () => {
    for (const url of [
      undefined,
      '',
      'chrome://settings',
      'chrome-extension://abc/fullview.html',
      'about:blank',
      'file:///home/user/doc.pdf',
      'view-source:https://example.test',
      'edge://extensions',
      'https://chrome.google.com/webstore/category/extensions',
      'https://chromewebstore.google.com/detail/mimik/abc',
    ]) {
      expect(isRecordableUrl(url), url).toBe(false);
    }
  });
});
