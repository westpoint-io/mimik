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
  MousePointer2,
  Pause,
  Play,
  Trash2,
  TriangleAlert,
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
  pointer: MousePointer2,
  alert: TriangleAlert,
};

export type IconName = keyof typeof ICONS;

export function icon(name: IconName, size = 15): SVGElement {
  return createElement(ICONS[name], { width: String(size), height: String(size), 'aria-hidden': 'true' });
}
