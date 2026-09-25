import './core-env';
import './overlay.css';
import { boundary } from './overlay/boundary';
import { controls } from './overlay/controls';
import { editor } from './overlay/editor';
import { intro } from './overlay/intro';

const [role, originX, originY] = window.location.hash.slice(1).split(':');
const origin = { x: Number(originX) || 0, y: Number(originY) || 0 };

if (role === 'editor') editor(origin);
else if (role === 'boundary') boundary();
else if (role === 'intro') intro();
else controls();
