import type { CaptureSnapshot, CaptureStateValue, PauseReason } from './machine';

export interface CaptureStateUpdate {
  state: CaptureStateValue;
  stepCount: number;
  currentGuideId: string | null;
  pauseReason: PauseReason | null;
}

export function captureStateUpdate(snapshot: CaptureSnapshot): CaptureStateUpdate {
  return {
    state: snapshot.value,
    stepCount: snapshot.context.stepCount,
    currentGuideId: snapshot.context.currentGuideId,
    pauseReason: snapshot.context.pauseReason ?? null,
  };
}
