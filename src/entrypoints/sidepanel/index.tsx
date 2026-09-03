import ReactDOM from 'react-dom/client';
import '@/lib/i18n-runtime';
import { startSidepanelVoiceHost } from '@/lib/sidepanel-voice-host';
import App from '@/ui/sidepanel/App';
import '@/ui/global.css';

startSidepanelVoiceHost();

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
