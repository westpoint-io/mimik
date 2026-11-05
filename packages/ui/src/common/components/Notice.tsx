import { i18n } from '@mimik/core/env';
import { Check, X } from 'lucide-react';
import { useEffect } from 'react';

interface NoticeProps {
  title: string | null;
  onDismiss: () => void;
  duration?: number;
}

export function Notice({ title, onDismiss, duration = 8000 }: NoticeProps) {
  useEffect(() => {
    if (!title) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [title, duration, onDismiss]);

  if (!title) return null;

  return (
    <div
      role="status"
      className="fixed z-50 bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-sm rounded-xl border border-border bg-card shadow-lg px-3.5 py-3 flex items-start gap-2.5"
    >
      <Check size={15} className="shrink-0 mt-0.5 text-success" />
      <p className="flex-1 min-w-0 text-[12px] font-semibold text-foreground leading-relaxed">{title}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={i18n.t('common.close')}
        className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}
