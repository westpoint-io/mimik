import { createOverlayRoot } from '@/core/capture/dom/overlay-root';
import { svgElement } from './dom/svg-element';

const ANIMATION_DURATION_MS = 4000;
const FILL_DURATION = '2s';
const FILL_DELAY = '0.5s';

const STYLES = `
  :host {
    position: fixed;
    inset: 0;
    z-index: 2147483646;
    pointer-events: none;
  }

  .wrap {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: show ${ANIMATION_DURATION_MS}ms ease forwards;
  }

  @keyframes show {
    0% { opacity: 0; }
    8% { opacity: 1; }
    75% { opacity: 1; }
    100% { opacity: 0; }
  }

  .mascot-wrap {
    position: relative;
    width: clamp(120px, 20vw, 250px);
    aspect-ratio: 200 / 150;
    animation: bounceSquash 1.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both;
  }

  .mascot-wrap svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  .wink-eye {
    transform-origin: 124px 117px;
    animation: wink 0.45s ease 2.8s;
  }

  @keyframes bounceSquash {
    0%   { transform: translateY(-80px) scaleY(1.1) scaleX(0.9); opacity: 0; }
    25%  { transform: translateY(10px) scaleY(0.85) scaleX(1.12); opacity: 1; }
    40%  { transform: translateY(-15px) scaleY(1.05) scaleX(0.97); }
    55%  { transform: translateY(5px) scaleY(0.95) scaleX(1.03); }
    70%  { transform: translateY(-3px) scaleY(1.02) scaleX(0.99); }
    100% { transform: translateY(0) scaleY(1) scaleX(1); }
  }

  @keyframes wink {
    0%   { transform: scaleY(1); }
    35%  { transform: scaleY(0.05); }
    50%  { transform: scaleY(0.05); }
    75%  { transform: scaleY(1.15); }
    100% { transform: scaleY(1); }
  }
`;

function buildMascotSVG(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="20 50 160 120" width="200" height="150">
    <defs>
      <mask id="riseMask">
        <rect x="20" y="50" width="160" height="120" fill="black"/>
        <rect x="20" y="170" width="160" height="120" fill="white">
          <animate attributeName="y" from="170" to="50" dur="${FILL_DURATION}" begin="${FILL_DELAY}" fill="freeze" calcMode="spline" keySplines="0.22 0.61 0.36 1"/>
        </rect>
      </mask>
    </defs>
    <g opacity="0.3">
      <rect x="30" y="95" width="140" height="68" rx="5" fill="#0F0E2A"/>
      <path d="M30 95 L30 80 Q30 60, 100 60 Q170 60, 170 80 L170 95 Z" fill="#0F0E2A"/>
      <rect x="30" y="93" width="140" height="3" fill="#252360"/>
      <path d="M68 122 Q76 112 84 122" stroke="#252360" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M116 122 Q124 112 132 122" stroke="#252360" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M84 138 Q100 148 116 138" stroke="#252360" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    </g>
    <g mask="url(#riseMask)">
      <rect x="30" y="95" width="140" height="68" rx="5" fill="#1E1B4B"/>
      <path d="M30 95 L30 80 Q30 60, 100 60 Q170 60, 170 80 L170 95 Z" fill="#3730A3"/>
      <rect x="30" y="93" width="140" height="3" fill="#C7D2FE"/>
      <path d="M68 122 Q76 112 84 122" stroke="#C7D2FE" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path class="wink-eye" d="M116 122 Q124 112 132 122" stroke="#C7D2FE" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M84 138 Q100 148 116 138" stroke="#C7D2FE" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    </g>
  </svg>`;
}

export function showStartNotification(): Promise<void> {
  return new Promise((resolve) => {
    const { host, shadow } = createOverlayRoot(STYLES, 'mimik-notification');

    const wrap = document.createElement('div');
    wrap.className = 'wrap';

    const mascotWrap = document.createElement('div');
    mascotWrap.className = 'mascot-wrap';
    mascotWrap.append(svgElement(buildMascotSVG()));

    wrap.appendChild(mascotWrap);
    shadow.appendChild(wrap);
    document.documentElement.appendChild(host);

    wrap.addEventListener('animationend', (e) => {
      if (e.target !== wrap) return;
      host.remove();
      resolve();
    });
  });
}
