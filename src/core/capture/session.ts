import { logger } from '@/lib/logger';
import { type GetStateResponse, sendMessage } from '@/lib/messaging';
import { type CaptureHandle, startCapture } from './events/handlers';
import { CaptureState } from './machine';

export class CaptureSession {
  private capture: CaptureHandle | null = null;
  private activeGuideId: string | null = null;
  private disabled = false;

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
