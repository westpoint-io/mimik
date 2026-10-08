import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { createOverlayRoot } from '@/core/capture/dom/overlay-root';
import css from './page-ui.css?inline';
import { withPropertyFallbacks } from './with-property-fallbacks';

export interface PageUi {
  render: (node: ReactNode) => void;
  unmount: () => void;
}

export function mountInPage(tag?: string): PageUi {
  const { host, shadow } = createOverlayRoot(withPropertyFallbacks(css), tag);
  const container = document.createElement('div');
  shadow.appendChild(container);
  document.documentElement.appendChild(host);
  const root = createRoot(container);
  return {
    render: (node) => root.render(node),
    unmount: () => {
      root.unmount();
      host.remove();
    },
  };
}
