import { isMimikElement } from '@/core/capture/dom/element-utils';

const REACTION_WINDOW_MS = 800;
const WINDOW_SIGNALS = ['pagehide', 'beforeunload', 'blur'] as const;
const DOCUMENT_SIGNALS = ['submit', 'scroll', 'play', 'copy', 'cut', 'visibilitychange'] as const;

function ours(node: Node): boolean {
  const element = node instanceof Element ? node : node.parentElement;
  return !!element && isMimikElement(element);
}

export function watchPageReaction(windowMs = REACTION_WINDOW_MS): Promise<boolean> {
  const href = location.href;
  return new Promise((resolve) => {
    const finish = (result: boolean) => {
      observer.disconnect();
      clearTimeout(timer);
      for (const type of WINDOW_SIGNALS) window.removeEventListener(type, reacted);
      for (const type of DOCUMENT_SIGNALS) document.removeEventListener(type, reacted, true);
      resolve(result);
    };
    const reacted = () => finish(true);
    const observer = new MutationObserver((records) => {
      const changed = records.some((record) => {
        if (ours(record.target)) return false;
        if (record.type !== 'childList') return true;
        return [...record.addedNodes, ...record.removedNodes].some((node) => !ours(node));
      });
      if (changed) reacted();
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    for (const type of WINDOW_SIGNALS) window.addEventListener(type, reacted);
    for (const type of DOCUMENT_SIGNALS) document.addEventListener(type, reacted, true);
    const timer = setTimeout(() => finish(location.href !== href), windowMs);
  });
}
