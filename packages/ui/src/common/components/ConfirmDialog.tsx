import { i18n } from '@mimik/core/env';
import { Button } from '@mimik/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mimik/ui/components/ui/dialog';

interface ConfirmDialogProps {
  open: boolean;
  heading: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  heading,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel}>
            {i18n.t('common.cancel')}
          </Button>
          <Button variant={destructive ? 'destructive' : 'default'} size="sm" onClick={onConfirm}>
            {confirmLabel ?? i18n.t('common.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
