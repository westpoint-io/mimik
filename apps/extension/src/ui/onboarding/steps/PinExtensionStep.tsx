import { ProgressDots, type StepProps } from '@mimik/ui';
import { i18n } from '#imports';

export function PinExtensionStep({ onNext, onBack, index, total }: StepProps) {
  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col justify-center" style={{ padding: '80px 64px' }}>
        <div className="max-w-md">
          <p className="text-xs font-semibold text-accent mb-2 tracking-wide uppercase">
            {i18n.t('onboarding.stepOf', [String(index), String(total)])}
          </p>
          <h1 className="text-3xl font-extrabold text-foreground leading-tight mb-2">
            {i18n.t('onboarding.pinTitle')}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8">{i18n.t('onboarding.pinMessage')}</p>

          <ol className="space-y-4 mb-8">
            <li className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-accent text-xs font-bold">1</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{i18n.t('onboarding.pinStep1Title')}</p>
                <p className="text-xs text-muted-foreground">{i18n.t('onboarding.pinStep1Sub')}</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-accent text-xs font-bold">2</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{i18n.t('onboarding.pinStep2Title')}</p>
                <p className="text-xs text-muted-foreground">{i18n.t('onboarding.pinStep2Sub')}</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-accent text-xs font-bold">3</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{i18n.t('onboarding.pinStep3Title')}</p>
                <p className="text-xs text-muted-foreground">{i18n.t('onboarding.pinStep3Sub')}</p>
              </div>
            </li>
          </ol>

          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="px-8 py-3 bg-card text-foreground border border-border rounded-xl font-semibold text-sm hover:border-accent hover:text-accent transition-colors"
            >
              {i18n.t('common.back')}
            </button>
            <button
              onClick={onNext}
              className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              {i18n.t('common.continue')}
            </button>
          </div>

          <div className="mt-6">
            <ProgressDots current={index} total={total} />
          </div>
        </div>
      </div>
      <div className="w-1/2 bg-deep flex items-center justify-center relative overflow-hidden">
        <div className="absolute w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(79,70,229,0.2),transparent_70%)] top-[10%] right-[-10%]" />
        <div className="animate-[float_4s_ease-in-out_infinite] relative z-10">
          <img
            src="/pin-screenshot.png"
            alt={i18n.t('onboarding.pinScreenshotAlt')}
            className="rounded-xl shadow-2xl max-w-[400px]"
          />
        </div>
      </div>
    </div>
  );
}
