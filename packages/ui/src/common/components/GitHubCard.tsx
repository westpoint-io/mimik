import { i18n } from '@mimik/core/env';
import { Bug, Star } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { tabs } from '../../env';
import { MascotIcon } from './MascotIcon';

const REPO_URL = 'https://github.com/westpoint-io/mimik';

export function GitHubCard() {
  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-border bg-card p-3.5">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-[14px] bg-secondary">
        <MascotIcon size={36} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-foreground">{i18n.t('settings.starCtaTitle')}</p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{i18n.t('settings.starCtaMessage')}</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void tabs.create(REPO_URL)} className="rounded-lg text-[12px] font-semibold">
            <Star size={14} className="fill-amber-400 text-amber-400" />
            {i18n.t('settings.starOnGithub')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void tabs.create(`${REPO_URL}/issues`)}
            className="rounded-lg text-[12px] font-semibold"
          >
            <Bug size={14} />
            {i18n.t('settings.reportBug')}
          </Button>
        </div>
      </div>
    </div>
  );
}
