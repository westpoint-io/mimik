import './core-env';
import './splash.css';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { SplashScreen } from './SplashScreen';

const root = createRoot(document.body.appendChild(document.createElement('div')));
flushSync(() => root.render(<SplashScreen />));
