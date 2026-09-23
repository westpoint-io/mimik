import { i18n } from '@mimik/core/env';
import { Globe } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { type RecordableTab, tabs as tabsApi } from '../../env';

interface CaptureTabDialogProps {
  open: boolean;
  onCancel: () => void;
  onStart: (tabId: number) => void;
}

export default function CaptureTabDialog({ open, onCancel, onStart }: CaptureTabDialogProps) {
  const [tabs, setTabs] = useState<RecordableTab[]>([]);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    tabsApi.recordable().then(setTabs);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{i18n.t('capture.moreStepsTitle')}</DialogTitle>
          <DialogDescription>{i18n.t('capture.moreStepsBody')}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[240px] overflow-y-auto flex flex-col gap-1.5">
          {tabs.length === 0 ? (
            <p className="text-[13px] text-muted-foreground py-2">{i18n.t('capture.noRecordableTabs')}</p>
          ) : (
            tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelected(tab.id)}
                aria-pressed={selected === tab.id}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                  selected === tab.id ? 'border-accent bg-secondary' : 'border-border hover:bg-secondary'
                }`}
              >
                {tab.favIconUrl ? (
                  <img src={tab.favIconUrl} alt="" width={16} height={16} className="shrink-0 rounded" />
                ) : (
                  <Globe size={16} className="shrink-0 text-muted-foreground" />
                )}
                <span className="text-[13px] text-foreground truncate">{tab.title}</span>
              </button>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel}>
            {i18n.t('common.cancel')}
          </Button>
          <Button size="sm" disabled={selected === null} onClick={() => selected !== null && onStart(selected)}>
            {i18n.t('capture.startCapture')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
