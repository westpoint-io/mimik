import { logger } from '@mimik/core/logger';
import { browser } from '#imports';

interface ShortcutHandlers {
  record: () => Promise<unknown>;
  pause: () => Promise<unknown>;
  capture: () => Promise<unknown>;
}

const COMMANDS: Record<string, keyof ShortcutHandlers> = {
  'toggle-recording': 'record',
  'toggle-pause': 'pause',
  'capture-now': 'capture',
};

export function registerShortcuts(handlers: ShortcutHandlers): void {
  browser.commands.onCommand.addListener((command) => {
    const name = COMMANDS[command];
    if (!name) return;
    handlers[name]().catch((err) => logger.error(`Shortcut ${command} failed`, err));
  });
}
