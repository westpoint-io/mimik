import { strFromU8, unzipSync } from 'fflate';
import { BundleError, type BundleManifest, MANIFEST_PATH, parseManifest } from './schema';

export interface ParsedBundle {
  manifest: BundleManifest;
  images: Map<string, Blob>;
}

const MAX_UNPACKED_BYTES = 200 * 1024 * 1024;

const MAX_FILE_BYTES = 100 * 1024 * 1024;

export async function readBundle(file: Blob): Promise<ParsedBundle> {
  if (file.size > MAX_FILE_BYTES) throw new BundleError('unreadable', 'bundle is implausibly large');

  let entries: Record<string, Uint8Array>;
  try {
    let unpacked = 0;
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()), {
      filter: (entry) => {
        unpacked += entry.originalSize;
        if (unpacked > MAX_UNPACKED_BYTES) throw new Error('bundle is implausibly large');
        return true;
      },
    });
  } catch {
    throw new BundleError('unreadable', 'file could not be unzipped');
  }

  const manifestEntry = entries[MANIFEST_PATH];
  if (!manifestEntry) throw new BundleError('not-a-bundle', `no ${MANIFEST_PATH} in the archive`);

  let raw: unknown;
  try {
    raw = JSON.parse(strFromU8(manifestEntry));
  } catch {
    throw new BundleError('not-a-bundle', `${MANIFEST_PATH} is not valid JSON`);
  }

  const manifest = parseManifest(raw);

  const images = new Map<string, Blob>();
  for (const shot of manifest.screenshots) {
    const entry = entries[shot.file];
    if (entry) images.set(shot.file, new Blob([entry as unknown as BlobPart], { type: shot.mimeType }));
  }

  return { manifest, images };
}
