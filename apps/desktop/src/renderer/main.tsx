import './core-env';
import './ui-env';
import './capture-host';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(<App />);
