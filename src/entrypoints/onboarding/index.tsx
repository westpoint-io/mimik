import ReactDOM from 'react-dom/client';
import '@/lib/i18n-runtime';
import OnboardingApp from '@/ui/onboarding/App';
import '@/ui/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<OnboardingApp />);
