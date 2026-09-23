import { IS_FIREFOX } from './constants';
import { ensureOffscreenDocument } from './ensure-offscreen-document';

export function ensureVoiceHost(): Promise<boolean> {
  if (IS_FIREFOX) return Promise.resolve(true);
  return ensureOffscreenDocument();
}
