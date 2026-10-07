import '@/lib/core-env';
import '@/lib/ui-env';
import ReactDOM from 'react-dom/client';
import { startSidepanelVoiceHost } from '@/lib/voice/start-sidepanel-voice-host';
import { App } from '@/ui/sidepanel/App';
import '@mimik/ui/global.css';

startSidepanelVoiceHost();

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
