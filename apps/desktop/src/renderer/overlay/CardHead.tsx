import { i18n } from '@mimik/core/env';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { MODES } from './lib/modes';

interface CardHeadProps {
  label: string;
  count: number;
  recording: boolean;
  paused: boolean;
  collapsed: boolean;
  mode: string;
  onCollapse: () => void;
}

export function CardHead({ label, count, recording, paused, collapsed, mode, onCollapse }: CardHeadProps) {
  const shown = MODES.find((candidate) => candidate.id === mode) ?? MODES[0];
  const counted = [String(count)];
  const toggleLabel = i18n.t(collapsed ? 'desktop.expand' : 'desktop.collapse');
  const dot = recording
    ? `animate-[breathe_1.6s_ease-in-out_infinite] ${collapsed ? 'bg-red-400' : 'bg-destructive shadow-[0_0_0_3px_rgba(220,38,38,0.18)]'}`
    : 'bg-gray-400';

  return (
    <div
      id="head"
      className={`flex items-center gap-2 text-[12.5px] whitespace-nowrap [-webkit-app-region:drag] ${
        collapsed ? 'py-2 pr-2 pl-3.5' : 'border-b border-secondary py-2.5 pr-2.5 pl-3.5'
      }`}
    >
      <span id="dot" className={`size-2 shrink-0 rounded-full ${dot}`} />
      <span id="label" className="mr-auto font-semibold">
        {label}
      </span>
      <span
        id="counter"
        hidden={!paused}
        className={`text-[11.5px] font-medium tabular-nums ${collapsed ? 'text-lavender' : 'text-muted-foreground'}`}
      >
        {i18n.t(count === 1 ? 'guide.stepCount' : 'guide.stepCountPlural', counted)}
      </span>
      <span
        id="badge"
        hidden={paused || collapsed}
        className="flex items-center gap-[5px] rounded-full bg-secondary px-[9px] py-[3px] text-[11px] font-semibold text-accent"
      >
        <shown.Icon size={12} />
        {i18n.t(shown.label)}
      </span>
      <button
        id="collapse"
        type="button"
        aria-label={toggleLabel}
        onClick={onCollapse}
        className={`flex size-7 items-center justify-center ${
          collapsed ? 'order-last rounded-full bg-lavender/15 text-white' : 'rounded-lg text-muted-foreground'
        }`}
      >
        {collapsed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
    </div>
  );
}
