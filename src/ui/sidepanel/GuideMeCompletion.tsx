import { useEffect, useState } from 'react';
import { i18n } from '#imports';
import { getStepsForGuide } from '@/core/guides/service';
import type { Step } from '@/core/guides/types';

interface GuideMeCompletionProps {
  guideId: string;
  onDone: () => void;
  onRunAgain: (guideId: string) => void;
}

function CoolMascot() {
  return (
    <svg width="120" height="100" viewBox="20 50 160 120" className="mb-6">
      <rect x="30" y="95" width="140" height="68" rx="8" fill="#1E1B4B" />
      <path d="M30 95 L30 80 Q30 58, 100 58 Q170 58, 170 80 L170 95 Z" fill="#3730A3" />
      <rect x="30" y="93" width="140" height="3" fill="#C7D2FE" />
      <rect x="60" y="112" width="28" height="16" rx="4" fill="#0F0E2A" stroke="#C7D2FE" strokeWidth="2" />
      <rect x="112" y="112" width="28" height="16" rx="4" fill="#0F0E2A" stroke="#C7D2FE" strokeWidth="2" />
      <line x1="88" y1="120" x2="112" y2="120" stroke="#C7D2FE" strokeWidth="2" />
      <path d="M88 140 Q100 148 116 142" stroke="#C7D2FE" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="50" cy="68" r="4" fill="#4F46E5" />
      <circle cx="150" cy="68" r="4" fill="#4F46E5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GuideMeCompletion({ guideId, onDone, onRunAgain }: GuideMeCompletionProps) {
  const [steps, setSteps] = useState<Step[]>([]);

  useEffect(() => {
    getStepsForGuide(guideId).then(setSteps);
  }, [guideId]);

  return (
    <div className="min-h-screen bg-card flex flex-col px-7">
      <div className="flex flex-col items-center text-center pt-10 pb-4">
        <CoolMascot />
        <h1 className="text-[22px] font-[800] text-foreground mb-2">{i18n.t('guidemeCompletion.title')}</h1>
        <p className="text-[13px] text-muted-foreground">
          {i18n.t('guidemeCompletion.stepsCompletedPlural', [String(steps.length)])}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <div className="flex flex-col gap-2">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center gap-2.5 text-left">
              <div className="w-[22px] h-[22px] rounded-full bg-success flex items-center justify-center shrink-0">
                <CheckIcon />
              </div>
              <span className="text-[13px] text-muted-foreground">{step.description}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2.5 py-5">
        <button
          onClick={onDone}
          className="flex-1 py-3.5 rounded-lg font-semibold text-sm bg-secondary border border-border text-foreground hover:bg-secondary/80 transition-colors"
        >
          {i18n.t('guidemeCompletion.allDone')}
        </button>
        <button
          onClick={() => onRunAgain(guideId)}
          className="flex-1 py-3.5 rounded-lg font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {i18n.t('guidemeCompletion.runAgain')}
        </button>
      </div>
    </div>
  );
}
