import { useEffect, useRef, useState } from 'react';
import { browser, i18n } from '#imports';
import { isVoiceMessageFor } from '@/lib/voice/is-voice-message-for';
import { VOICE_SIDEPANEL_TARGET, type VoiceLevelEvent, VoiceMessage } from '@/lib/voice/voice-message';
import { LEVEL_STALE_MS, type MicActivity, micActivity } from './lib/mic-activity';
import { micActivityKey } from './lib/mic-activity-key';
import { MIC_BAR_MIN_SCALE, MIC_BARS, micBarScale } from './lib/mic-bar-scale';

const SWEEP_MS = 300;

export function MicMeter() {
  const bars = useRef<Array<HTMLSpanElement | null>>([]);
  const levelAt = useRef<number | null>(null);
  const speakingAt = useRef<number | null>(null);
  const [activity, setActivity] = useState<MicActivity>('waiting');

  useEffect(() => {
    const paint = (level: number) => {
      MIC_BARS.forEach((bar, index) => {
        const node = bars.current[index];
        if (node) node.style.transform = `scaleY(${micBarScale(level, bar.weight).toFixed(3)})`;
      });
    };

    const settle = (now: number) => {
      setActivity((previous) => {
        const next = micActivity(levelAt.current, speakingAt.current, now);
        return next === previous ? previous : next;
      });
    };

    const listener = (message: unknown) => {
      if (!isVoiceMessageFor(VOICE_SIDEPANEL_TARGET, message)) return;
      const event = message as VoiceLevelEvent;
      if (event.type !== VoiceMessage.VOICE_LEVEL) return;
      const now = Date.now();
      levelAt.current = now;
      if (event.speaking) speakingAt.current = now;
      paint(event.level);
      settle(now);
    };

    browser.runtime.onMessage.addListener(listener);
    const sweep = setInterval(() => {
      const now = Date.now();
      if (levelAt.current !== null && now - levelAt.current > LEVEL_STALE_MS) paint(0);
      settle(now);
    }, SWEEP_MS);

    return () => {
      browser.runtime.onMessage.removeListener(listener);
      clearInterval(sweep);
    };
  }, []);

  const speaking = activity === 'speaking';

  return (
    <div className="flex items-center gap-2" role="status" aria-live="polite">
      <span className="flex items-center gap-[3px] h-4" aria-hidden="true">
        {MIC_BARS.map((bar, index) => (
          <span
            key={bar.id}
            ref={(node) => {
              bars.current[index] = node;
            }}
            style={{ transform: `scaleY(${MIC_BAR_MIN_SCALE})` }}
            className={`w-[3px] h-4 rounded-full origin-center transition-transform duration-300 ease-out motion-reduce:transition-none ${
              speaking ? 'bg-accent' : 'bg-border'
            }`}
          />
        ))}
      </span>
      <span className={`text-[11px] font-medium ${speaking ? 'text-accent' : 'text-muted-foreground'}`}>
        {i18n.t(micActivityKey(activity))}
      </span>
    </div>
  );
}
