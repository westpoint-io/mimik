import { i18n } from '@mimik/core/env';
import { GitHubCard } from '@mimik/ui';
import { Shield } from 'lucide-react';

export function SettingsFooter() {
  return (
    <>
      <GitHubCard />
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-secondary text-[10px] text-muted-foreground leading-relaxed">
        <Shield size={12} className="shrink-0 mt-0.5 text-accent" />
        <span>{i18n.t('settings.privacyNotice')}</span>
      </div>
    </>
  );
}
