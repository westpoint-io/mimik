import { i18n } from '@mimik/core/env';
import { tabs } from '../../env';
import type { StepProps } from '../types';
import { MascotWithStar } from './MascotWithStar';
import { ProgressDots } from './ProgressDots';

const REPO_URL = 'https://github.com/westpoint-io/mimik';

export function GitHubStarStep({ onSkip, onBack, index, total }: StepProps) {
  const handleStar = () => {
    void tabs.create(REPO_URL);
  };

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col justify-center" style={{ padding: '80px 64px' }}>
        <div className="max-w-md">
          <p className="text-xs font-semibold text-accent mb-2 tracking-wide uppercase">
            {i18n.t('onboarding.stepOf', [String(index), String(total)])}
          </p>
          <h1 className="text-3xl font-extrabold text-foreground leading-tight mb-2">
            {i18n.t('onboarding.starTitle')}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8">{i18n.t('onboarding.starMessage')}</p>

          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="px-8 py-3 bg-card text-foreground border border-border rounded-xl font-semibold text-sm hover:border-accent hover:text-accent transition-colors"
            >
              {i18n.t('common.back')}
            </button>
            <button
              onClick={handleStar}
              className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              {i18n.t('onboarding.starAction')}
            </button>
            <button
              onClick={onSkip}
              className="ml-2 px-6 py-3 text-muted-foreground rounded-xl font-semibold text-sm hover:text-foreground transition-colors"
            >
              {i18n.t('onboarding.starLater')}
            </button>
          </div>

          <div className="mt-6">
            <ProgressDots current={index} total={total} />
          </div>
        </div>
      </div>
      <div className="w-1/2 bg-deep flex items-center justify-center relative overflow-hidden">
        <div className="absolute w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(79,70,229,0.2),transparent_70%)] top-[10%] right-[-10%]" />
        <div className="absolute w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(250,204,21,0.08),transparent_70%)] bottom-[14%] left-[8%]" />
        <div className="animate-[float_3s_ease-in-out_infinite] relative z-10">
          <MascotWithStar size={300} />
        </div>
      </div>
    </div>
  );
}
