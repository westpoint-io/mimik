import './core-env';
import './overlay.css';
import { TooltipProvider } from '@mimik/ui';
import { createRoot } from 'react-dom/client';
import { AreaEditor } from './overlay/AreaEditor';
import { Boundary } from './overlay/Boundary';
import { ControlsCard } from './overlay/ControlsCard';
import { intro } from './overlay/intro';

const [role, originX, originY] = window.location.hash.slice(1).split(':');
const origin = { x: Number(originX) || 0, y: Number(originY) || 0 };
const mount = () => createRoot(document.body.appendChild(document.createElement('div')));

if (role === 'intro') intro();
else if (role === 'editor') mount().render(<AreaEditor origin={origin} />);
else if (role === 'boundary') mount().render(<Boundary />);
else {
  document.body.classList.add('w-fit');
  mount().render(
    <TooltipProvider disableHoverableContent>
      <ControlsCard />
    </TooltipProvider>,
  );
}
