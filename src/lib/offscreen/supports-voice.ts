import { IS_FIREFOX } from './constants';
import { supportsOffscreen } from './supports-offscreen';

export function supportsVoice(): boolean {
  return IS_FIREFOX || supportsOffscreen();
}
