import { i18n } from '@mimik/core/env';
import { Star } from 'lucide-react';
import { MascotIcon } from '../../common/components/MascotIcon';
import { Button } from '../../components/ui/button';
import { tabs } from '../../env';

export function StarCard() {
  return (
    <section className="flex flex-wrap items-center gap-3.5 rounded-2xl border border-lavender/60 bg-card px-4 py-3.5">
      <span className="flex size-[46px] shrink-0 items-center justify-center rounded-xl bg-secondary">
        <MascotIcon size={32} />
      </span>
      <div className="min-w-[200px] flex-1 text-left">
        <p className="text-[13.5px] font-semibold text-foreground">{i18n.t('onboarding.starCardTitle')}</p>
        <p className="text-[12px] text-muted-foreground">{i18n.t('onboarding.starCardMessage')}</p>
      </div>
      <Button onClick={() => void tabs.create('https://github.com/westpoint-io/mimik')} className="rounded-[10px]">
        <Star size={15} className="fill-amber-400 text-amber-400" />
        {i18n.t('settings.starOnGithub')}
      </Button>
    </section>
  );
}
