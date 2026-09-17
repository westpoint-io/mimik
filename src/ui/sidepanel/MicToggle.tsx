import { Mic, MicOff } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { browser, i18n } from '#imports';
import { hasVoiceApiKey, VOICE_KEY_SETTINGS } from '@/core/capture/voice/api-key';
import { getActiveTab, localStorage } from '@/lib/browser-api';
import { logger } from '@/lib/logger';
import { sendMessage } from '@/lib/messaging';
import { abortVoiceCapture, openMicPermissionPage } from '@/lib/offscreen';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/components/ui/tooltip';

interface MicToggleProps {
  enabled: boolean;
  live: boolean;
  /** Narration cannot start while capture is paused, so the control locks
   *  rather than accepting a toggle the background will refuse. */
  paused?: boolean;
  onChange: (enabled: boolean) => void;
}

const MICROPHONE: PermissionDescriptor = { name: 'microphone' as PermissionName };

async function microphoneGranted(): Promise<boolean> {
  try {
    const status = await navigator.permissions.query(MICROPHONE);
    return status.state === 'granted';
  } catch {
    return false;
  }
}

export default function MicToggle({ enabled, live, paused = false, onChange }: MicToggleProps) {
  const [keyed, setKeyed] = useState(false);

  useEffect(() => {
    let active = true;
    const read = () =>
      localStorage.get([...VOICE_KEY_SETTINGS]).then((stored) => {
        if (active) setKeyed(hasVoiceApiKey(stored));
      });

    void read();

    const handler = (changes: Record<string, unknown>) => {
      if (VOICE_KEY_SETTINGS.some((key) => key in changes)) void read();
    };

    browser.storage.local.onChanged.addListener(handler);
    return () => {
      active = false;
      browser.storage.local.onChanged.removeListener(handler);
    };
  }, []);

  const locked = (!keyed && !enabled) || paused;

  const toggle = useCallback(async () => {
    if (locked) return;
    const next = !enabled;
    onChange(next);
    await localStorage.set({ voiceEnabled: next });

    if (!next) {
      if (live) await abortVoiceCapture().catch(() => undefined);
      return;
    }

    if (!(await microphoneGranted())) {
      const tab = await getActiveTab();
      await openMicPermissionPage(tab?.id).catch((error) => {
        logger.error('voice: the microphone permission page could not be opened', error);
      });
      return;
    }

    await sendMessage('startNarration', undefined).catch((error) => {
      logger.error('voice: the background did not take the request to start narration', error);
    });
  }, [enabled, live, locked, onChange]);

  const Icon = enabled ? Mic : MicOff;
  const label = paused
    ? i18n.t('voice.pausedWithCapture')
    : locked
      ? i18n.t('voice.needsApiKey')
      : i18n.t(enabled ? 'voice.turnOff' : 'voice.turnOn');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => void toggle()}
          aria-pressed={enabled}
          aria-disabled={locked}
          aria-label={label}
          className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors ${
            locked
              ? 'border-dashed border-border text-muted-foreground opacity-60 cursor-not-allowed'
              : enabled
                ? 'border-accent bg-secondary text-accent'
                : 'border-border text-muted-foreground hover:border-accent hover:text-accent'
          }`}
        >
          <Icon size={16} />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
