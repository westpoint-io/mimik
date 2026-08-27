import { beforeEach, describe, expect, it } from 'vitest';
import { browser } from '#imports';
import { dismissUpdateNotice, readUpdateNotice, recordUpdate, UPDATE_NOTICE_KEY } from '../update-notice';

describe('update notice', () => {
  beforeEach(async () => {
    await browser.storage.local.remove(UPDATE_NOTICE_KEY);
  });

  it('surfaces the new version after the browser applies an update', async () => {
    await recordUpdate('update');
    expect(await readUpdateNotice()).toBe('1.0.0');
  });

  it('stays quiet on a fresh install', async () => {
    await recordUpdate('install');
    expect(await readUpdateNotice()).toBeUndefined();
  });

  it('stays quiet when only the browser itself updated', async () => {
    await recordUpdate('chrome_update');
    expect(await readUpdateNotice()).toBeUndefined();
  });

  it('does not come back once dismissed', async () => {
    await recordUpdate('update');
    await dismissUpdateNotice();
    expect(await readUpdateNotice()).toBeUndefined();
  });
});
