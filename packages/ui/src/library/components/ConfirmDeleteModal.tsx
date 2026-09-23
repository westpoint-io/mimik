import { i18n } from '@mimik/core/env';
import { Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog';

interface ConfirmDeleteModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteModal({ open, onClose, onConfirm }: ConfirmDeleteModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent showCloseButton={false} className="max-w-[320px] p-7 text-center border-none">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <Trash2 size={22} className="text-destructive" />
          </div>
        </div>
        <DialogTitle className="text-center text-base">{i18n.t('confirmDelete_title')}</DialogTitle>
        <DialogDescription className="text-center">{i18n.t('confirmDelete_message')}</DialogDescription>
        <div className="flex flex-col gap-2 mt-2">
          <button
            onClick={onConfirm}
            className="w-full py-2.5 rounded-lg bg-destructive text-white text-sm font-semibold hover:bg-destructive/90 transition-colors"
          >
            {i18n.t('confirmDelete_confirm')}
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-lg bg-secondary text-foreground text-sm font-semibold hover:bg-lavender transition-colors"
          >
            {i18n.t('common_cancel')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
