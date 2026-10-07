import type { PublicPath } from 'wxt/browser';
import { browser } from '#imports';

type HtmlPublicPath = Extract<PublicPath, `${string}.html`>;

export function getExtensionURL(path: PublicPath): string;

export function getExtensionURL(path: `${HtmlPublicPath}${string}`): string;

export function getExtensionURL(path: string): string {
  return (browser.runtime as { getURL(p: string): string }).getURL(path);
}
