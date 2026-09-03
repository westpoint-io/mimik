import ReactDOM from 'react-dom/client';
import '@/lib/i18n-runtime';
import MicPermissionApp from '@/ui/mic-permission/App';
import '@/ui/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<MicPermissionApp />);
