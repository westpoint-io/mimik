import { voiceNotice } from '@mimik/core/capture/voice/voice-notice';
import type { VoiceUpdate } from '@mimik/core/capture/voice/voice-update';
import { i18n } from '@mimik/core/env';
import { Check, Loader2, TriangleAlert, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';

const TONE_ICONS = {
  progress: Loader2,
  done: Check,
  failed: TriangleAlert,
};

const TONE_CLASSES = {
  progress: 'text-accent animate-spin motion-reduce:animate-none',
  done: 'text-success',
  failed: 'text-destructive',
};

interface VoiceNoticeProps {
  update: VoiceUpdate;
  seenLive: boolean;
  onOpenSettings: () => void;
}

export function VoiceNotice({ update, seenLive, onOpenSettings }: VoiceNoticeProps) {
  const [dismissed, setDismissed] = useState<string | null>(null);
  const notice = voiceNotice(update, seenLive);
  const signature = notice?.signature;
  const autoDismissMs = notice?.autoDismissMs;

  useEffect(() => {
    if (!autoDismissMs || signature === undefined) return;
    const timer = setTimeout(() => setDismissed(signature), autoDismissMs);
    return () => clearTimeout(timer);
  }, [autoDismissMs, signature]);

  const shown = notice && dismissed !== notice.signature ? notice : null;
  const Icon = shown ? TONE_ICONS[shown.tone] : null;

  return (
    <div role="status" className="fixed bottom-5 right-5 z-50 w-[min(23rem,calc(100vw-2.5rem))] pointer-events-none">
      {shown && Icon && (
        <div className="pointer-events-auto rounded-xl border border-border bg-card shadow-lg px-3.5 py-3 flex items-start gap-2.5">
          <Icon size={15} className={`shrink-0 mt-0.5 ${TONE_CLASSES[shown.tone]}`} />

          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-foreground leading-relaxed">
              {i18n.t(shown.titleKey, shown.titleSubstitutions)}
            </p>
            {shown.bodyKey && (
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{i18n.t(shown.bodyKey)}</p>
            )}
            {shown.showSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="mt-1.5 text-[11px] font-semibold text-accent hover:underline"
              >
                {i18n.t('voice.openSettings')}
              </button>
            )}
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setDismissed(shown.signature)}
                className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent align="end">{i18n.t('common.close')}</TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
