import { Tooltip, TooltipContent, TooltipTrigger } from '@mimik/ui';
import { Check, Loader2, TriangleAlert, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { i18n } from '#imports';
import type { PanelVoiceUpdate } from '@/lib/port/types';
import { voiceSignature } from '@/ui/fullview/lib/voice-signature';
import { narratedKey } from './lib/narrated-key';
import { voiceErrorKey } from './lib/voice-error-key';

const CONFIRM_MS = 7000;

interface VoiceToastProps {
  update: PanelVoiceUpdate;
  confirmable: boolean;
  onOpenSettings: () => void;
}

export function VoiceToast({ update, confirmable, onOpenSettings }: VoiceToastProps) {
  const [dismissed, setDismissed] = useState<string | null>(null);
  const signature = voiceSignature(update);
  const confirming = update.phase === 'idle' && update.narrated !== undefined && confirmable;

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setDismissed(signature), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [confirming, signature]);

  const visible = update.phase === 'transcribing' || update.phase === 'error' || confirming;
  if (!visible || dismissed === signature) return null;

  const narrated = update.narrated ?? 0;

  return (
    <div
      role="status"
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] max-w-sm rounded-xl border border-border bg-card shadow-lg px-3 py-2.5 flex items-start gap-2.5"
    >
      {update.phase === 'transcribing' && (
        <Loader2 size={14} className="shrink-0 mt-0.5 text-accent animate-spin motion-reduce:animate-none" />
      )}
      {update.phase === 'error' && <TriangleAlert size={14} className="shrink-0 mt-0.5 text-destructive" />}
      {confirming && <Check size={14} className="shrink-0 mt-0.5 text-success" />}

      <div className="flex-1 min-w-0">
        {update.phase === 'transcribing' && (
          <>
            <p className="text-[11px] font-semibold text-foreground">{i18n.t('voice.transcribing')}</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">{i18n.t('voice.transcribingHint')}</p>
          </>
        )}

        {update.phase === 'error' && (
          <>
            <p className="text-[11px] font-semibold text-foreground leading-relaxed">
              {i18n.t(voiceErrorKey(update.reason))}
            </p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">{i18n.t('voice.guideSafe')}</p>
            {update.reason === 'missing-api-key' && (
              <button onClick={onOpenSettings} className="mt-1.5 text-[10px] font-semibold text-accent hover:underline">
                {i18n.t('voice.openSettings')}
              </button>
            )}
          </>
        )}

        {confirming && (
          <p className="text-[11px] font-semibold text-foreground">
            {narrated === 0 ? i18n.t('voice.narratedNone') : i18n.t(narratedKey(narrated), [String(narrated)])}
          </p>
        )}
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setDismissed(signature)}
            className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={13} />
          </button>
        </TooltipTrigger>
        <TooltipContent align="end">{i18n.t('common.close')}</TooltipContent>
      </Tooltip>
    </div>
  );
}
