import {
  AppWindow,
  Check,
  ChevronDown,
  ChevronUp,
  Crop,
  createElement,
  Keyboard,
  LoaderCircle,
  Monitor,
  Pause,
  Play,
  Trash2,
  Video,
} from 'lucide';

const ICONS = {
  video: Video,
  pause: Pause,
  play: Play,
  check: Check,
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
  trash: Trash2,
  loader: LoaderCircle,
  window: AppWindow,
  monitor: Monitor,
  area: Crop,
  keyboard: Keyboard,
};

export type IconName = keyof typeof ICONS;

export function icon(name: IconName, size = 15): SVGElement {
  return createElement(ICONS[name], { width: String(size), height: String(size), 'aria-hidden': 'true' });
}
