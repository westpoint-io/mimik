import { i18n } from '@mimik/core/env';
import { Dialog, DialogContent, DialogHeader, DialogTitle, SavedBadge, useSavedFlash } from '@mimik/ui';
import { SettingsPanel } from './SettingsPanel';

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { saved, flash } = useSavedFlash();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="gap-0 overflow-hidden p-0 sm:max-w-[880px]">
        <DialogHeader className="flex-row items-center border-b border-border py-4 pr-12 pl-6">
          <DialogTitle className="text-[15px] font-bold">{i18n.t('settings.title')}</DialogTitle>
          <SavedBadge saved={saved} />
        </DialogHeader>
        <SettingsPanel onSaved={flash} />
      </DialogContent>
    </Dialog>
  );
}
