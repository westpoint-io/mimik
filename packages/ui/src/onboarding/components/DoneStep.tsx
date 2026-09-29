import { client, i18n, localStorage } from '@mimik/core/env';
import { useEffect } from 'react';
import { MascotLarge } from './MascotLarge';

export function DoneStep({ onOpen }: { onOpen: () => void }) {
  const desktop = client() === 'desktop';

  useEffect(() => {
    void localStorage.set({ onboardingCompleted: true });
  }, []);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center max-w-lg">
        <div className="flex justify-center mb-8 animate-[float_3s_ease-in-out_infinite]">
          <MascotLarge size={120} />
        </div>
        <h1 className="text-4xl font-extrabold text-foreground mb-3 tracking-tight">
          {i18n.t('onboarding.doneTitle')}
        </h1>
        <p className="text-base text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
          {i18n.t(desktop ? 'onboarding.doneMessageDesktop' : 'onboarding.doneMessage')}
        </p>

        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {[
            {
              label: i18n.t('onboarding.featureAutoCapture'),
              icon: (
                <>
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                </>
              ),
            },
            {
              label: i18n.t('onboarding.featureVoice'),
              icon: (
                <>
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
                </>
              ),
            },
            {
              label: i18n.t('onboarding.featureAIAssist'),
              icon: <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z" />,
            },
            {
              label: i18n.t('onboarding.featureAnnotate'),
              icon: (
                <>
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </>
              ),
            },
            !desktop && {
              label: i18n.t('onboarding.featureSmartBlur'),
              icon: (
                <>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              ),
            },
            {
              label: i18n.t('onboarding.featureExports'),
              icon: (
                <>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="M7 10l5 5 5-5M12 15V3" />
                </>
              ),
            },
          ]
            .filter((f) => f !== false)
            .map((f) => (
              <div key={f.label} className="w-[calc((100%-1.5rem)/3)] bg-secondary rounded-xl px-3 py-4 text-center">
                <div className="text-accent flex justify-center mb-2">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    {f.icon}
                  </svg>
                </div>
                <p className="text-xs font-semibold text-foreground">{f.label}</p>
              </div>
            ))}
        </div>

        <button
          onClick={onOpen}
          className="inline-flex items-center gap-2 px-7 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
        >
          {i18n.t('onboarding.openMimik')}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
