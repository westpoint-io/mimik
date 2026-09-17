import { logger } from '@/lib/logger';
import { type GetStateResponse, sendMessage } from '@/lib/messaging';
import { type CaptureHandle, startCapture } from './events/handlers';
import { CaptureState } from './machine';

export class CaptureSession {
  private capture: CaptureHandle | null = null;
  private activeGuideId: string | null = null;
  private disabled = false;

  /**
   * @param onSynced Called once with whatever the background reports when this
   *   frame boots, so a caller can react to states this session ignores —
   *   notably PAUSED, which must re-open the blur overlay rather than capture.
   */
  constructor(private readonly onSynced?: (state: GetStateResponse) => void) {
    this.syncWithBackground();
  }

  get isActive(): boolean {
    return this.activeGuideId !== null;
  }

  get isDisabled(): boolean {
    return this.disabled;
  }

  get guideId(): string | null {
    return this.activeGuideId;
  }

  start(guideId: string): void {
    if (this.disabled) return;
    if (this.isActive) {
      this.stop();
    }

    logger.info('Capture started → guideId:', guideId);
    this.activeGuideId = guideId;
    const isTopFrame = window.self === window.top;
    this.capture = startCapture(guideId, isTopFrame);
  }

  /** Resolves once in-flight capture work has drained. Callers that pause a
   *  recording await this so a typing session's final screenshot still lands. */
  stop(): Promise<void> {
    if (!this.isActive) return Promise.resolve();

    logger.info('Capture stopped → guideId:', this.activeGuideId);
    const draining = this.capture?.stop() ?? Promise.resolve();
    this.capture = null;
    this.activeGuideId = null;
    return draining;
  }

  private syncWithBackground(): void {
    sendMessage('getState', undefined)
      .then((res) => {
        if (this.disabled) return;
        if (res.state === CaptureState.RECORDING && res.currentGuideId) {
          this.start(res.currentGuideId);
        }
        this.onSynced?.(res);
      })
      .catch(() => {});
  }

  dispose(): void {
    this.stop();
    this.disabled = true;
    logger.debug('Capture session disposed');
  }
}
