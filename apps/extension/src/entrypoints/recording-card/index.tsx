import '@/lib/core-env';
import '@/lib/ui-env';
import { TooltipProvider } from '@mimik/ui';
import ReactDOM from 'react-dom/client';
import { PageCard } from '@/ui/recording-card/PageCard';
import '@mimik/ui/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <TooltipProvider disableHoverableContent>
    <PageCard />
  </TooltipProvider>,
);
