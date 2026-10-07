import { logger } from '@mimik/core/logger';
import { CaptureState } from '@/core/capture/machine';
import { sendMessage } from '@/lib/messaging';
import { type CaptureHandle, startCapture } from './events/handlers';

export class CaptureSession {
  private capture: CaptureHandle | null = null;
  private activeGuideId: string | null = null;
  private disabled = false;

  constructor() {
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

  stop(): void {
    if (!this.isActive) return;

    logger.info('Capture stopped → guideId:', this.activeGuideId);
    this.capture?.stop();
    this.capture = null;
    this.activeGuideId = null;
  }

  private syncWithBackground(): void {
    sendMessage('getState', undefined)
      .then((res) => {
        if (this.disabled) return;
        if (res.state === CaptureState.RECORDING && res.currentGuideId) {
          this.start(res.currentGuideId);
        }
      })
      .catch(() => {});
  }

  dispose(): void {
    this.stop();
    this.disabled = true;
    logger.debug('Capture session disposed');
  }
}
