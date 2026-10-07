import '@/lib/core-env';
import '@/lib/ui-env';
import ReactDOM from 'react-dom/client';
import { MicPermissionApp } from '@/ui/mic-permission/App';
import '@mimik/ui/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<MicPermissionApp />);
