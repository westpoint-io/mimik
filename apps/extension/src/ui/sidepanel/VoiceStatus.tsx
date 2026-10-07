import { TriangleAlert } from 'lucide-react';
import { i18n } from '#imports';
import { voiceErrorKey } from '@/core/capture/voice/voice-error-key';
import type { PanelVoiceUpdate } from '@/lib/port/types';
import { MicMeter } from './MicMeter';

interface VoiceStatusProps {
  update: PanelVoiceUpdate;
  enabled: boolean;
  paused?: boolean;
}

export function VoiceStatus({ update, enabled, paused = false }: VoiceStatusProps) {
  if (update.phase === 'error') {
    return (
      <div className="px-4 pt-2.5 flex items-start gap-2" role="status">
        <TriangleAlert size={13} className="shrink-0 mt-0.5 text-destructive" />
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">{i18n.t(voiceErrorKey(update.reason))}</span>{' '}
          {i18n.t('voice.guideSafe')}
        </p>
      </div>
    );
  }

  if (update.phase === 'recording') {
    return (
      <div className="px-4 pt-2.5 space-y-1.5">
        <MicMeter />
        <p className="text-[10px] leading-relaxed text-muted-foreground">{i18n.t('voice.orderHint')}</p>
      </div>
    );
  }

  if (!enabled || update.phase !== 'idle') return null;

  return (
    <div className="px-4 pt-2.5" role="status">
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        {i18n.t(paused ? 'voice.pausedWithCapture' : 'voice.nextRecording')}
      </p>
    </div>
  );
}
