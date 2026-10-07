import { offscreenApi } from './offscreen-api';

export function supportsOffscreen(): boolean {
  return offscreenApi() !== undefined;
}
