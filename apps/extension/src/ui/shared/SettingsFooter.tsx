import { i18n } from '@mimik/core/env';
import { GitHubCard } from '@mimik/ui';
import { Info } from 'lucide-react';
import { browser } from '#imports';

export function SettingsFooter() {
  return (
    <>
      <GitHubCard />
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-secondary text-[11px] text-muted-foreground">
        <Info size={12} className="shrink-0 text-accent" />
        <span>{i18n.t('settings.version', [browser.runtime.getManifest().version])}</span>
      </div>
    </>
  );
}
