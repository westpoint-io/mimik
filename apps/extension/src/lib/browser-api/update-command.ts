import { browser } from '#imports';

type Commands = typeof browser.commands & {
  update?: (detail: { name: string; shortcut: string }) => Promise<void>;
};

export function updateCommand(name: string, shortcut: string): Promise<void> {
  const commands = browser.commands as Commands;
  if (!commands.update) return Promise.reject(new Error('This browser cannot change shortcuts'));
  return commands.update({ name, shortcut });
}
