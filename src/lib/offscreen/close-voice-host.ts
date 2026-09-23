import { closeOffscreenDocument } from './close-offscreen-document';
import { IS_FIREFOX } from './constants';

export async function closeVoiceHost(): Promise<void> {
  if (IS_FIREFOX) return;
  await closeOffscreenDocument();
}
