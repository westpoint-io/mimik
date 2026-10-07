import type { PublicPath } from 'wxt/browser';
import { browser } from '#imports';

type ScriptPath = Extract<PublicPath, `${string}.js`>;

export function executeScript(tabId: number, files: ScriptPath[], allFrames = true): Promise<unknown> {
  return browser.scripting.executeScript({
    target: { tabId, allFrames },
    files,
  });
}
