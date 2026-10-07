import { i18n } from '@mimik/core/env';
import { Dialog, DialogContent, DialogTitle } from '@mimik/ui';
import { Hand, Monitor } from 'lucide-react';
import { useEffect } from 'react';
import { useCapturePermissions } from './hooks/use-capture-permissions';
import { PermissionCard } from './PermissionCard';
import { PermissionsMascot } from './PermissionsMascot';

const CONTINUE_DELAY_MS = 800;

export function PermissionsDialog({ open, onClose }: { open: boolean; onClose(granted: boolean): void }) {
  const { granted, restart, grant } = useCapturePermissions(open);
  const ready = granted?.accessibility === true && granted.screen;

  useEffect(() => {
    if (!open || !ready) return;
    const timer = setTimeout(() => onClose(true), CONTINUE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [open, ready, onClose]);

  const screenState = granted?.screen ? 'granted' : restart ? 'restart' : 'missing';

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose(false)}>
      <DialogContent aria-describedby={undefined} className="gap-3.5 px-8 pb-8 pt-9 sm:max-w-[500px]">
        <div className="mb-2.5 flex flex-col items-center gap-2.5 text-center">
          <PermissionsMascot granted={[granted?.accessibility === true, granted?.screen === true]} />
          <DialogTitle className="text-[22px] font-bold">{i18n.t('desktop.permissionsTitle')}</DialogTitle>
          <p className="text-[13.5px] text-muted-foreground">{i18n.t('desktop.permissionsIntro')}</p>
        </div>
        <PermissionCard
          Icon={Hand}
          title={i18n.t('desktop.permissionAccessibility')}
          hint={i18n.t('desktop.permissionAccessibilityHint')}
          state={granted?.accessibility ? 'granted' : 'missing'}
          onGrant={() => grant('accessibility')}
          onRestart={() => window.mimik.permissions.restart()}
        />
        <PermissionCard
          Icon={Monitor}
          title={i18n.t('desktop.permissionScreen')}
          hint={i18n.t(screenState === 'restart' ? 'desktop.permissionScreenRestart' : 'desktop.permissionScreenHint')}
          state={screenState}
          onGrant={() => grant('screen')}
          onRestart={() => window.mimik.permissions.restart()}
        />
      </DialogContent>
    </Dialog>
  );
}
