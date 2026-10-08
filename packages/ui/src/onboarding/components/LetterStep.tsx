import { client, i18n } from '@mimik/core/env';
import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { MascotIcon } from '../../common/components/MascotIcon';
import { Button } from '../../components/ui/button';
import { tabs } from '../../env';
import { StepNav } from './StepNav';

const REPO_URL = 'https://github.com/westpoint-io/mimik';
const SLOT = '[[slot]]';
const PARAGRAPH = 'text-[13.5px] leading-relaxed text-foreground/80';
const LINK = 'font-semibold text-foreground underline underline-offset-[3px]';
const ASKS = [
  ['✍️', 'onboarding.letterAskWrite'],
  ['🎥', 'onboarding.letterAskVideo'],
  ['💬', 'onboarding.letterAskFriend'],
] as const;

export function LetterStep({ onFinish }: { onFinish: () => void }) {
  const withSlot = (key: string, slot: ReactNode) => {
    const [before, after] = i18n.t(key, [SLOT]).split(SLOT);
    return (
      <>
        {before}
        {slot}
        {after}
      </>
    );
  };
  const link = (url: string, key: string) => (
    <button type="button" className={LINK} onClick={() => void tabs.create(url)}>
      {i18n.t(key)}
    </button>
  );

  return (
    <>
      <section className="flex max-h-[calc(100vh-190px)] flex-col gap-3.5 overflow-y-auto rounded-[18px] border border-lavender/60 bg-card px-7 py-6 text-left [scrollbar-width:thin] max-[640px]:px-4">
        <div className="mx-auto">
          <MascotIcon size={84} />
        </div>
        <h1 className="text-center text-[23px] font-bold text-foreground">{i18n.t('onboarding.letterHello')}</h1>
        <p className={PARAGRAPH}>
          {withSlot(
            'onboarding.letterThanks',
            <b className="text-foreground">{i18n.t('onboarding.letterThankYou')}</b>,
          )}
        </p>
        <p className={PARAGRAPH}>{withSlot('onboarding.letterWorld', link(REPO_URL, 'onboarding.letterSayHi'))}</p>
        {client() === 'extension' && (
          <div className="flex flex-wrap items-center gap-3.5 rounded-[14px] bg-gradient-to-br from-secondary to-lavender/50 p-4">
            <div className="min-w-[200px] flex-1">
              <p className="text-[15px] font-bold text-foreground">{i18n.t('onboarding.letterNewsTitle')}</p>
              <p className="text-[12.5px] text-foreground/80">{i18n.t('onboarding.letterNewsBody')}</p>
            </div>
            <Button onClick={() => void tabs.create(`${REPO_URL}/releases/latest`)} className="rounded-[10px]">
              {i18n.t('onboarding.letterNewsAction')}
              <ArrowRight size={15} />
            </Button>
          </div>
        )}
        <h2 className="mt-1.5 text-[15px] font-bold text-foreground">{i18n.t('onboarding.letterPromiseTitle')}</h2>
        <p className={`${PARAGRAPH} border-l-[3px] border-primary py-1 pl-3`}>{i18n.t('onboarding.letterPromise')}</p>
        <h2 className="mt-1.5 text-[15px] font-bold text-foreground">{i18n.t('onboarding.letterAskTitle')}</h2>
        <p className={PARAGRAPH}>{i18n.t('onboarding.letterAskIntro')}</p>
        <ul className="flex flex-col gap-2">
          {ASKS.map(([emoji, key]) => (
            <li
              key={key}
              className="flex items-start gap-2.5 rounded-[10px] border border-lavender/60 bg-background px-3 py-2.5 text-[13px] text-foreground"
            >
              <span className="text-base leading-tight">{emoji}</span>
              <span>{i18n.t(key)}</span>
            </li>
          ))}
        </ul>
        <p className={PARAGRAPH}>
          {withSlot(
            'onboarding.letterSponsor',
            link('https://github.com/sponsors/westpoint-io', 'onboarding.letterSponsorLink'),
          )}
        </p>
        <p className="text-[13px] text-foreground/80">
          {i18n.t('onboarding.letterSignoff')}
          <span className="mt-1.5 flex items-center gap-2 font-semibold text-foreground">
            <svg viewBox="0 0 32 32" width="24" height="24" role="img" aria-label="Westpoint" className="shrink-0">
              <rect width="32" height="32" rx="4" fill="#1E1B4B" />
              <rect x="3.8" y="3.8" width="24.4" height="24.4" fill="none" stroke="#fff" strokeWidth="1.1" />
              <path
                transform="translate(16 16) scale(1.25) translate(-15.83 -16.12)"
                d="M22.342 11.242L19.514 21H18.086L15.818 13.146L13.466 21L12.052 21.014L9.322 11.242H10.68L12.808 19.516L15.16 11.242H16.588L18.828 19.488L20.97 11.242H22.342Z"
                fill="#fff"
              />
            </svg>
            {i18n.t('onboarding.letterTeam')}
          </span>
        </p>
      </section>
      <StepNav onNext={onFinish} nextLabel={i18n.t('onboarding.openMimik')} />
    </>
  );
}
