import { db } from '@/core/guides/db';
import { logger } from '@/lib/logger';

const MAX_CLIPS = 500;

export async function clipKey(provider: string, voiceId: string, modelId: string, text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const hash = Array.from(new Uint8Array(digest))
    .slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `${provider}:${voiceId}:${modelId}:${hash}`;
}

export async function readClip(id: string): Promise<ArrayBuffer | null> {
  try {
    const row = await db.voiceClips.get(id);
    return row?.bytes ?? null;
  } catch (error) {
    logger.error('[voiceover] cache read failed', error);
    return null;
  }
}

export async function writeClip(id: string, bytes: ArrayBuffer): Promise<void> {
  try {
    await db.voiceClips.put({ id, bytes, createdAt: Date.now() });
    const count = await db.voiceClips.count();
    if (count > MAX_CLIPS) {
      const stale = await db.voiceClips
        .orderBy('createdAt')
        .limit(count - MAX_CLIPS)
        .primaryKeys();
      await db.voiceClips.bulkDelete(stale);
    }
  } catch (error) {
    logger.error('[voiceover] cache write failed', error);
  }
}

export async function clearClips(): Promise<void> {
  await db.voiceClips.clear();
}
