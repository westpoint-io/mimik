import './core-env';
import { i18n } from '@mimik/core/env';
import './splash.css';
import { el } from './overlay/el';
import { mascot } from './overlay/mascot';

document.body.append(
  el(
    'main',
    { id: 'splash' },
    el('div', { id: 'mascot' }, mascot(116)),
    el('p', { id: 'wordmark' }, 'Mimik'),
    el('div', { id: 'meter', role: 'progressbar', ariaLabel: i18n.t('common_loading') }, el('span', {})),
  ),
);
