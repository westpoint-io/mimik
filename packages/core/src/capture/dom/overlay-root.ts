export interface OverlayRoot {
  host: HTMLElement;
  shadow: ShadowRoot;
}

export function createOverlayRoot(styles: string, tag = 'div'): OverlayRoot {
  const host = document.createElement(tag);
  host.setAttribute('data-mimik-ignore', '');
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = styles;
  shadow.appendChild(style);
  return { host, shadow };
}
