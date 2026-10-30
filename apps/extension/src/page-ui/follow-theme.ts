import { browser } from '#imports';

const KEY = 'mimikTheme';

export function followTheme(element: HTMLElement): () => void {
  const system = matchMedia('(prefers-color-scheme: dark)');
  let choice: unknown;
  const apply = () => {
    element.classList.toggle('dark', choice === 'dark' || (choice !== 'light' && system.matches));
  };
  const onStored = (changes: Record<string, { newValue?: unknown }>) => {
    if (!(KEY in changes)) return;
    choice = changes[KEY].newValue;
    apply();
  };
  apply();
  browser.storage.local.get(KEY).then((stored) => {
    choice = stored[KEY];
    apply();
  });
  system.addEventListener('change', apply);
  browser.storage.onChanged.addListener(onStored);
  return () => {
    system.removeEventListener('change', apply);
    browser.storage.onChanged.removeListener(onStored);
  };
}
