import { CaptureState, type CaptureStateValue } from './machine';

export function isLive(state: CaptureStateValue | string | undefined): boolean {
  return state === CaptureState.RECORDING || state === CaptureState.PAUSED;
}
