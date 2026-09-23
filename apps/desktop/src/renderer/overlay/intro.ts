import { showStartNotification } from '@mimik/core/capture/start-notification';

export function intro(): void {
  document.body.className = 'intro';
  void showStartNotification().then(() => window.mimikOverlay.command('intro:done'));
}
