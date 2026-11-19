import { CaptureState } from '@mimik/core/capture/machine';
import { RecordingCard } from '@mimik/ui';
import { DesktopMic } from './DesktopMic';
import { ModeBadge } from './ModeBadge';
import { ModePicker } from './ModePicker';
import { useOverlayView } from './use-overlay-view';

export function ControlsCard() {
  const view = useOverlayView();
  return (
    <RecordingCard
      view={view}
      onCommand={(command) => window.mimikOverlay.command(command)}
      mic={<DesktopMic paused={view?.state === CaptureState.PAUSED} />}
      badge={view && <ModeBadge mode={view.mode} />}
      pausedExtra={view && <ModePicker hidden={false} mode={view.mode} />}
      onLayout={() => window.mimikOverlay.size(document.body.scrollWidth, document.body.scrollHeight)}
    />
  );
}
