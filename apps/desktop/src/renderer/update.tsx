import './core-env';
import './update.css';
import { createRoot } from 'react-dom/client';
import { UpdateWindow } from './UpdateWindow';

createRoot(document.body.appendChild(document.createElement('div'))).render(<UpdateWindow />);
