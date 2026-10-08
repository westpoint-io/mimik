import { voiceErrorKey } from '@mimik/core/capture/voice/voice-error-key';
import { i18n } from '@mimik/core/env';
import type { OverlayNarration } from '../../main/overlay';

const BARS = [
  { id: 'outer-left', weight: 0.45 },
  { id: 'left', weight: 0.75 },
  { id: 'middle', weight: 1 },
  { id: 'right', weight: 0.75 },
  { id: 'outer-right', weight: 0.45 },
];
const FLOOR = 0.14;

interface VoiceLineProps {
  narration: OverlayNarration | null;
  hidden: boolean;
  hintHidden: boolean;
}

export function VoiceLine({ narration, hidden, hintHidden }: VoiceLineProps) {
  const failed = Boolean(narration?.reason);
  const speaking = narration?.speaking === true;
  const label = narration?.reason
    ? i18n.t(voiceErrorKey(narration.reason))
    : i18n.t(speaking ? 'voice.micHearing' : 'voice.micQuiet');

  return (
    <div id="voice" role="status" hidden={hidden} className="mt-3 rounded-[9px] bg-secondary px-2.5 py-2">
      <div className="flex items-center gap-2 text-[11.5px] font-semibold text-foreground">
        <span hidden={failed} className="flex h-3.5 shrink-0 items-center gap-0.5">
          {BARS.map(({ id, weight }) => (
            <i
              key={id}
              style={{ transform: `scaleY(${Math.max(FLOOR, Math.min(1, (narration?.level ?? 0) * weight))})` }}
              className={`h-3.5 w-[3px] rounded-full transition-transform duration-300 ease-out motion-reduce:transition-none ${
                speaking ? 'bg-accent' : 'bg-lavender'
              }`}
            />
          ))}
        </span>
        <strong>{label}</strong>
      </div>
      <p hidden={hintHidden && !failed} className="mt-1 text-[10.5px] leading-normal text-muted-foreground">
        {i18n.t(failed ? 'voice.guideSafe' : 'voice.orderHint')}
      </p>
    </div>
  );
}
