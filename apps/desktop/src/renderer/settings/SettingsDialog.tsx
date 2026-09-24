import { i18n } from '@mimik/core/env';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@mimik/ui';
import { SettingsPanel } from './SettingsPanel';

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="gap-0 overflow-hidden p-0 sm:max-w-[880px]">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="text-[15px] font-bold">{i18n.t('settings_title')}</DialogTitle>
        </DialogHeader>
        <SettingsPanel />
      </DialogContent>
    </Dialog>
  );
}
