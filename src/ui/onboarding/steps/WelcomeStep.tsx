import { i18n } from '#imports';
import { MascotLarge } from '../MascotLarge';

export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col justify-center" style={{ padding: '80px 64px' }}>
        <div className="max-w-lg">
          <span className="inline-flex text-xs font-semibold text-accent bg-secondary px-3.5 py-1.5 rounded-full mb-6">
            {i18n.t('onboarding.welcomeBadge')}
          </span>
          <h1 className="text-4xl font-extrabold text-foreground leading-tight mb-3 tracking-tight">
            {i18n.t('onboarding.welcomeTitle')}
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed mb-10 max-w-md">
            {i18n.t('onboarding.welcomeMessage')}
          </p>
          <button
            onClick={onNext}
            className="inline-flex items-center gap-2 px-7 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
          >
            {i18n.t('onboarding.getStarted')}
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
      <div className="w-1/2 bg-deep flex items-center justify-center relative overflow-hidden">
        <div className="absolute w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(79,70,229,0.2),transparent_70%)] top-[10%] right-[-10%]" />
        <div className="absolute w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(56,189,248,0.1),transparent_70%)] bottom-[10%] left-[10%]" />
        <div className="animate-[float_3s_ease-in-out_infinite]">
          <MascotLarge size={280} />
        </div>
      </div>
    </div>
  );
}
