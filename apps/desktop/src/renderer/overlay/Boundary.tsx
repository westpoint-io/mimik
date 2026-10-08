import { CaptureState } from '@mimik/core/capture/machine';
import { useOverlayView } from './use-overlay-view';

export function Boundary() {
  const state = useOverlayView()?.state;
  const look =
    state === CaptureState.PAUSED
      ? 'border-dashed border-muted-foreground'
      : state === CaptureState.ARMED
        ? 'border-dashed border-mascot'
        : 'border-mascot';
  return <div id="frame" className={`fixed inset-0 rounded-[2px] border-[3px] ${look}`} />;
}
