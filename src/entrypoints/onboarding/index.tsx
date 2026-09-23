import '@/lib/core-env';
import '@/lib/ui-env';
import ReactDOM from 'react-dom/client';
import { OnboardingApp } from '@/ui/onboarding/App';
import '@mimik/ui/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<OnboardingApp />);
