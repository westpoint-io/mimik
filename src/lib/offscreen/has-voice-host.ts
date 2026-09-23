import { isVoiceStatus } from '../voice/is-voice-status';
import { IS_FIREFOX } from './constants';
import { getVoiceStatus } from './get-voice-status';
import { hasOffscreenDocument } from './has-offscreen-document';

export async function hasVoiceHost(): Promise<boolean> {
  if (!IS_FIREFOX) return hasOffscreenDocument();
  return isVoiceStatus(await getVoiceStatus().catch(() => null));
}
