import { showStartNotification } from '@mimik/core/capture/start-notification';

export function intro(): void {
  void showStartNotification().then(() => window.mimikOverlay.command('intro:done'));
}
