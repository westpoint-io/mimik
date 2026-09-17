import { Check, ChevronDown, ChevronUp, createElement, Pause, Play, Video } from 'lucide';

const ICONS = {
  video: Video,
  pause: Pause,
  play: Play,
  check: Check,
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
};

export type IconName = keyof typeof ICONS;

export function icon(name: IconName, size = 15): SVGElement {
  return createElement(ICONS[name], { width: String(size), height: String(size), 'aria-hidden': 'true' });
}
