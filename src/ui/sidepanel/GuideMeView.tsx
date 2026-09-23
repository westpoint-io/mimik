import FaviconImg from '@mimik/ui/common/components/FaviconImg';
import { extractDomain } from '@mimik/ui/common/lib/utils';
import ScreenshotView from '@mimik/ui/guide/components/ScreenshotView';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { browser, i18n } from '#imports';
import { stepRequiresManual } from '@/core/guideme/manual';
import type { GuideMeSession } from '@/core/guideme/session';
import { BLOCKED_KEY, SESSION_KEY } from '@/core/guideme/session';
import { actionSteps } from '@/core/guides/blocks';
import { getGuide } from '@/core/guides/service';
import type { Guide, Screenshot, Step } from '@/core/guides/types';
import { sendMessage } from '@/lib/messaging';

interface GuideMeViewProps {
  guideId: string;
  onExit: () => void;
  onComplete: (guideId: string) => void;
}

interface GuideData {
  guide: Guide;
  steps: Step[];
  screenshots: Map<string, Screenshot>;
}

function SadMascot() {
  return (
    <svg width="64" height="54" viewBox="20 55 160 108">
      <rect x="30" y="95" width="140" height="68" rx="8" fill="#1E1B4B" />
      <path d="M30 95 L30 80 Q30 58, 100 58 Q170 58, 170 80 L170 95 Z" fill="#3730A3" />
      <rect x="30" y="93" width="140" height="3" fill="#C7D2FE" />
      <circle cx="74" cy="118" r="10" fill="#0F0E2A" />
      <circle cx="126" cy="118" r="10" fill="#0F0E2A" />
      <circle cx="74" cy="120" r="6" fill="#C7D2FE" />
      <circle cx="126" cy="120" r="6" fill="#C7D2FE" />
      <path d="M88 146 Q100 138 112 146" stroke="#C7D2FE" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function ExitConfirmation({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-card/80 backdrop-blur-[2px]">
      <div className="bg-card rounded-2xl border border-border shadow-lg p-6 w-[280px] text-center flex flex-col items-center">
        <SadMascot />
        <h3 className="text-[15px] font-bold text-foreground mt-3 mb-1">{i18n.t('guideme.exitTitle')}</h3>
        <p className="text-[12px] text-muted-foreground leading-relaxed mb-5">{i18n.t('guideme.exitMessage')}</p>
        <div className="flex gap-2.5 w-full">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg font-semibold text-sm bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
          >
            {i18n.t('guideme.stay')}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-lg font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {i18n.t('guideme.exit')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GuideMeView({ guideId, onExit, onComplete }: GuideMeViewProps) {
  const [data, setData] = useState<GuideData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [blockedStepIndex, setBlockedStepIndex] = useState<number | null>(null);

  const loadGuide = useCallback(async () => {
    const result = await getGuide(guideId);
    if (!result) {
      setLoading(false);
      return;
    }
    setData(result);
    setLoading(false);
  }, [guideId]);

  useEffect(() => {
    loadGuide();
  }, [loadGuide]);

  useEffect(() => {
    const handler = (changes: Record<string, { newValue?: unknown }>) => {
      if (changes[BLOCKED_KEY]) {
        setBlockedStepIndex((changes[BLOCKED_KEY].newValue as number | null) ?? null);
      }
      if (!changes[SESSION_KEY]) return;
      const session = changes[SESSION_KEY].newValue as GuideMeSession | null;
      if (!session) return;
      if (!session.active) {
        onComplete(guideId);
        return;
      }
      setActiveStepIndex(session.activeStepIndex);
    };

    browser.storage.local.onChanged.addListener(handler);
    return () => browser.storage.local.onChanged.removeListener(handler);
  }, [guideId, onComplete]);

  useEffect(() => {
    browser.storage.local.get([SESSION_KEY, BLOCKED_KEY]).then((result: Record<string, unknown>) => {
      const session = result[SESSION_KEY] as GuideMeSession | null;
      if (session?.active) setActiveStepIndex(session.activeStepIndex);
      setBlockedStepIndex((result[BLOCKED_KEY] as number | null) ?? null);
    });
  }, []);

  const steps = actionSteps(data?.steps ?? []);
  const viewedStep = steps[activeStepIndex] ?? null;
  const viewedScreenshot = viewedStep ? data?.screenshots.get(viewedStep.id) : undefined;

  if (loading) return <p className="text-sm text-purple p-4">{i18n.t('common.loading')}</p>;
  if (!data) return <p className="text-sm text-purple p-4">{i18n.t('guideme.guideNotFound')}</p>;

  const totalSteps = steps.length;
  const viewedIsManual = viewedStep ? stepRequiresManual(viewedStep, viewedScreenshot) : false;
  const showRoadblock = !viewedIsManual && blockedStepIndex === activeStepIndex;
  const goTo = (stepIndex: number) => sendMessage('guideMeGoTo', { stepIndex }).catch(() => {});

  return (
    <div className="min-h-screen bg-card flex flex-col relative">
      {showExitConfirm && <ExitConfirmation onCancel={() => setShowExitConfirm(false)} onConfirm={onExit} />}
      <div className="px-4 pt-3 pb-2 flex items-center gap-2">
        <button
          onClick={() => setShowExitConfirm(true)}
          className="shrink-0 p-1 rounded text-purple hover:text-foreground"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="flex-1 text-sm font-semibold text-foreground truncate">{data.guide.title}</span>
        <span className="shrink-0 flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-success/10 text-success">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          {i18n.t('guideme.live')}
        </span>
      </div>

      <div className="px-4 pb-3 flex gap-1">
        {steps.map((step, idx) => (
          <div
            key={step.id}
            className={`flex-1 h-[3px] rounded-[1.5px] ${
              idx < activeStepIndex ? 'bg-success' : idx === activeStepIndex ? 'bg-accent' : 'bg-border'
            }`}
          />
        ))}
      </div>

      <div className="px-4 pb-3">
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 pb-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-secondary text-accent px-2.5 py-1 rounded-full mb-2.5">
              <span className="w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center text-[10px] font-bold">
                {activeStepIndex + 1}
              </span>
              {i18n.t('guideme.stepOf', [String(activeStepIndex + 1), String(totalSteps)])}
            </span>
            <p className="text-[15px] font-semibold text-foreground leading-snug">
              {viewedStep?.description || i18n.t('guideme.noDescription')}
            </p>
            {viewedStep?.url && (
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1.5">
                <FaviconImg domain={extractDomain(viewedStep.url)} size={14} className="rounded-full" />
                {extractDomain(viewedStep.url)}
              </span>
            )}
          </div>

          {viewedScreenshot && (
            <ScreenshotView
              key={viewedScreenshot.id}
              screenshot={viewedScreenshot}
              alt={i18n.t('guideme.stepOf', [String(activeStepIndex + 1), String(totalSteps)])}
              crop
              readOnly
              className="mx-4 mb-3"
            />
          )}

          {(viewedIsManual || showRoadblock) && (
            <p className="mx-4 mb-3 flex items-start gap-2 rounded-lg bg-secondary p-3 text-[12px] leading-relaxed text-foreground">
              <TriangleAlert size={14} className="shrink-0 mt-0.5 text-accent" />
              {viewedIsManual ? i18n.t('guideme.manualStep') : i18n.t('guideme.roadblock')}
            </p>
          )}

          <div className="flex items-center justify-between px-4 pb-3">
            <button
              onClick={() => goTo(activeStepIndex - 1)}
              disabled={activeStepIndex === 0}
              className="flex items-center gap-1 text-xs font-medium text-purple hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} />
              {i18n.t('guideme.prev')}
            </button>
            <button
              onClick={() => sendMessage('guideMeStepCompleted', { stepIndex: activeStepIndex }).catch(() => {})}
              className="flex items-center gap-1 text-xs font-medium text-purple hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {activeStepIndex === totalSteps - 1 ? i18n.t('guideme.finish') : i18n.t('guideme.next')}
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 pb-4 overflow-y-auto">
        {steps.map((step, idx) => {
          const isDone = idx < activeStepIndex;
          const isActive = idx === activeStepIndex;
          return (
            <button
              key={step.id}
              onClick={() => goTo(idx)}
              className={`w-full flex items-start gap-2.5 py-2 px-2 rounded-lg text-left transition-colors ${
                activeStepIndex === idx ? 'bg-secondary' : 'hover:bg-secondary/50'
              }`}
            >
              {isDone ? (
                <span className="shrink-0 w-5 h-5 rounded-full bg-success flex items-center justify-center mt-0.5">
                  <Check size={12} className="text-white" strokeWidth={3} />
                </span>
              ) : isActive ? (
                <span className="shrink-0 w-5 h-5 rounded-full bg-accent flex items-center justify-center text-[10px] font-bold text-white mt-0.5">
                  {idx + 1}
                </span>
              ) : (
                <span className="shrink-0 w-5 h-5 rounded-full border-2 border-border flex items-center justify-center text-[10px] font-medium text-muted-foreground mt-0.5">
                  {idx + 1}
                </span>
              )}
              <span
                className={`text-[13px] leading-snug ${
                  isDone
                    ? 'text-muted-foreground'
                    : isActive
                      ? 'font-semibold text-foreground'
                      : 'text-muted-foreground/60'
                }`}
              >
                {step.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
