import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { allScreenshotIds } from '../service';

afterEach(async () => {
  await db.screenshots.clear();
});

describe('allScreenshotIds', () => {
  it('keeps the file a copied row still points at, not only the row ids', async () => {
    await db.screenshots.bulkAdd([
      { id: 'a1', stepId: 's1', src: 'mimik-screenshot://a1', mimeType: 'image/png', width: 1, height: 1 },
      { id: 'b2', stepId: 's2', src: 'mimik-screenshot://a1', mimeType: 'image/png', width: 1, height: 1 },
      { id: 'c3', stepId: 's3', blob: new Blob(['x']), mimeType: 'image/png', width: 1, height: 1 },
    ]);
    await db.screenshots.delete('a1');
    expect((await allScreenshotIds()).sort()).toEqual(['a1', 'b2', 'c3']);
  });
});
