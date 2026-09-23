import '@/lib/core-env';
import '@/lib/ui-env';
import ReactDOM from 'react-dom/client';
import { FullViewApp } from '@/ui/fullview/App';
import '@mimik/ui/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<FullViewApp />);
