const SEEN_VERSION = 'mimik.seenVersion';
const UPDATE_NOTICE = 'mimik.updateNotice';

export function updatedVersion(storage: Storage, running: string): string | undefined {
  const seen = storage.getItem(SEEN_VERSION);
  if (seen !== null && seen !== running) storage.setItem(UPDATE_NOTICE, running);
  storage.setItem(SEEN_VERSION, running);
  return storage.getItem(UPDATE_NOTICE) ?? undefined;
}
