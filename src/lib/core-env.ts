import { i18n } from '#imports';
import { configureCore } from '@/core/env';
import { getExtensionURL } from '@/lib/browser-api/get-extension-url';
import { localStorage } from '@/lib/browser-api/local-storage';

configureCore({
  client: 'extension',
  t: (key, substitutions) => i18n.t(key as never, substitutions as never),
  assetUrl: (path) => getExtensionURL(path as never),
  storage: localStorage,
});
