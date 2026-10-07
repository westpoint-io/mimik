import { extractDomain } from '@mimik/core/guides/domain';
import {
  Button,
  CameraMascot,
  ScreenshotView,
  StepSourceBadge,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@mimik/ui';
import { Check, EyeOff, Loader2, Pause, Play, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { i18n } from '#imports';
import type { PauseReason } from '@/core/capture/machine';
import { deleteStep, getScreenshotsForSteps, getStepsForGuide } from '@/core/guides/service';
import type { Screenshot, Step } from '@/core/guides/types';
import { getActiveTab } from '@/lib/browser-api/get-active-tab';
import { localStorage } from '@/lib/browser-api/local-storage';
import { sendMessage } from '@/lib/messaging';
import type { PanelAiUpdate, PanelVoiceUpdate } from '@/lib/port/types';
import { AiStatus } from './AiStatus';
import { timeAgo } from './lib/time-ago';
import { MicToggle } from './MicToggle';
import { VoiceStatus } from './VoiceStatus';

interface RecordingViewProps {
  guideId: string;
  onStop: () => void;
  onDiscard: () => void;
  voice: PanelVoiceUpdate;
  aiFailure: PanelAiUpdate | null;
  paused: boolean;
  pauseReason: PauseReason | null;
}

interface LiveStep {
  step: Step;
  screenshot?: Screenshot;
}

export function RecordingView({
  guideId,
  onStop,
  onDiscard,
  voice,
  aiFailure,
  paused,
  pauseReason,
}: RecordingViewProps) {
  const [steps, setSteps] = useState<LiveStep[]>([]);
  const [siteUrl, setSiteUrl] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [, setTick] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadSteps = useCallback(async () => {
    const allSteps = await getStepsForGuide(guideId);
    const screenshotIds = allSteps.map((s) => s.screenshotId).filter(Boolean) as string[];
    const screenshotMap = await getScreenshotsForSteps(screenshotIds);

    setSteps(
      allSteps.map((step) => ({
        step,
        screenshot: screenshotMap.get(step.id),
      })),
    );

    if (allSteps.length > 0 && !siteUrl) {
      setSiteUrl(allSteps[0].url || '');
    }
  }, [guideId, siteUrl]);

  useEffect(() => {
    loadSteps();
    const interval = setInterval(loadSteps, 800);
    return () => clearInterval(interval);
  }, [loadSteps]);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (steps.length === 0) return;
    const scroll = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    scroll();
    const t = setTimeout(scroll, 300);
    return () => clearTimeout(t);
  }, [steps.length]);

  useEffect(() => {
    getActiveTab().then((tab) => {
      if (tab?.url) setSiteUrl(tab.url);
    });
  }, []);

  useEffect(() => {
    if (import.meta.env.BROWSER === 'firefox') return;
    localStorage.get(['voiceEnabled']).then((stored) => setVoiceEnabled(stored.voiceEnabled === true));
  }, []);

  useEffect(() => {
    if (voice.phase !== 'error' || voice.reason !== 'permission-denied') return;
    setVoiceEnabled(false);
    void localStorage.set({ voiceEnabled: false });
  }, [voice.phase, voice.reason]);

  const handleBlur = useCallback(async () => {
    await sendMessage('enterBlurMode', undefined);
  }, []);

  const handlePause = useCallback(async () => {
    await sendMessage('pauseCapture', undefined);
  }, []);

  const handleResume = useCallback(async () => {
    await sendMessage(pauseReason === 'blur' ? 'exitBlurMode' : 'resumeCapture', undefined);
  }, [pauseReason]);

  const handleDeleteStep = useCallback(
    async (stepId: string) => {
      await deleteStep(guideId, stepId);
      await loadSteps();
    },
    [guideId, loadSteps],
  );

  return (
    <div className="flex flex-col h-screen bg-card relative">
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 backdrop-blur-sm border border-border shadow-sm">
        <span className={`w-2 h-2 rounded-full ${paused ? 'bg-accent' : 'bg-destructive animate-pulse'}`} />
        <span className="text-xs font-semibold text-foreground">
          {paused
            ? i18n.t(pauseReason === 'blur' ? 'recording.capturePausedBlur' : 'recording.capturePaused')
            : steps.length === 1
              ? i18n.t('recording.recording', [String(steps.length)])
              : i18n.t('recording.recordingPlural', [String(steps.length)])}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto pt-12">
        {steps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <CameraMascot size={64} />
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">{i18n.t('recording.readyTitle')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{i18n.t('recording.readySub')}</p>
            </div>
          </div>
        ) : (
          <div>
            {steps.map((liveStep, idx) => (
              <div key={liveStep.step.id}>
                <div className="px-4 pb-4 group">
                  {liveStep.screenshot && (
                    <div className="mb-2">
                      <ScreenshotView
                        screenshot={liveStep.screenshot}
                        alt={liveStep.step.description}
                        className="shadow-sm"
                        crop
                        animate
                        readOnly
                      />
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {liveStep.step.aiPending ? (
                        <p className="flex items-center gap-1.5 text-[13px] font-medium leading-snug text-muted-foreground">
                          <Loader2 size={13} className="animate-spin" />
                          {i18n.t(
                            voice.phase === 'recording' || voice.phase === 'transcribing'
                              ? 'editor.transcribingStepDescription'
                              : 'editor.writingStepDescription',
                          )}
                        </p>
                      ) : (
                        <p className="text-[13px] font-medium leading-snug text-foreground">
                          {liveStep.step.description}
                        </p>
                      )}
                      <span className="flex items-baseline gap-1.5 text-[10px] text-purple">
                        {!liveStep.step.aiPending && <StepSourceBadge source={liveStep.step.descriptionSource} />}
                        <span>
                          {timeAgo(liveStep.step.timestamp)} · {extractDomain(liveStep.step.url || siteUrl)}
                        </span>
                      </span>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleDeleteStep(liveStep.step.id)}
                          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity motion-reduce:transition-none p-1 rounded text-border hover:text-destructive"
                        >
                          <X size={13} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent align="end">{i18n.t('recording.deleteStep')}</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                {idx < steps.length - 1 && <div className="mx-4 mb-4 h-px bg-border" />}
              </div>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-border">
        <AiStatus update={aiFailure} />
        {import.meta.env.BROWSER !== 'firefox' && <VoiceStatus update={voice} enabled={voiceEnabled} paused={paused} />}
        <div className="px-4 py-2.5 flex items-center gap-1.5">
          <Button onClick={onStop} className="flex-1 min-w-0 h-9 rounded-full font-semibold text-[13px]">
            <Check size={16} strokeWidth={3} />
            <span className="truncate">{i18n.t('recording.finishRecording')}</span>
          </Button>
          {import.meta.env.BROWSER !== 'firefox' && (
            <MicToggle
              enabled={voiceEnabled}
              live={voice.phase === 'recording'}
              paused={paused}
              onChange={setVoiceEnabled}
            />
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="shrink-0">
                <button
                  onClick={handleBlur}
                  disabled={paused}
                  className="w-9 h-9 shrink-0 rounded-full border border-border flex items-center justify-center transition-colors text-muted-foreground hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <EyeOff size={16} />
                </button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{i18n.t('recording.smartBlur')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={paused ? handleResume : handlePause}
                className={`w-9 h-9 shrink-0 rounded-full border flex items-center justify-center transition-colors ${
                  paused
                    ? 'border-accent text-accent hover:bg-secondary'
                    : 'border-border text-muted-foreground hover:border-accent hover:text-accent'
                }`}
              >
                {paused ? <Play size={16} /> : <Pause size={16} />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{i18n.t(paused ? 'recording.resumeCapture' : 'recording.pauseCapture')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onDiscard}
                className="w-9 h-9 shrink-0 rounded-full border border-border flex items-center justify-center transition-colors text-purple hover:border-destructive/30 hover:text-destructive"
              >
                <Trash2 size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent align="end">{i18n.t('recording.discard')}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
