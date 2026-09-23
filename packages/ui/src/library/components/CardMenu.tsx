import { i18n } from '@mimik/core/env';
import { MoreVertical, RotateCcw, Star, StarOff, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function CardMenu({
  guideId,
  starred,
  category,
  onStar,
  onTrash,
  onRestore,
  onPermanentDelete,
}: {
  guideId: string;
  starred: boolean;
  category: string;
  onStar: (e: React.MouseEvent, id: string) => void;
  onTrash: (e: React.MouseEvent, id: string) => void;
  onRestore: (e: React.MouseEvent, id: string) => void;
  onPermanentDelete: (e: React.MouseEvent, id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const items: {
    icon: React.ReactNode;
    label: string;
    onClick: (e: React.MouseEvent) => void;
    destructive?: boolean;
  }[] = [];

  if (category === 'trash') {
    items.push({
      icon: <RotateCcw size={13} />,
      label: i18n.t('common_restore'),
      onClick: (e) => {
        onRestore(e, guideId);
        setOpen(false);
      },
    });
    items.push({
      icon: <Trash2 size={13} />,
      label: i18n.t('library_deletePermanently'),
      onClick: (e) => {
        onPermanentDelete(e, guideId);
        setOpen(false);
      },
      destructive: true,
    });
  } else {
    items.push({
      icon: starred ? <StarOff size={13} /> : <Star size={13} />,
      label: starred ? i18n.t('common_unstar') : i18n.t('common_star'),
      onClick: (e) => {
        onStar(e, guideId);
        setOpen(false);
      },
    });
    items.push({
      icon: <Trash2 size={13} />,
      label: i18n.t('library_moveToTrash'),
      onClick: (e) => {
        onTrash(e, guideId);
        setOpen(false);
      },
      destructive: true,
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <div
          className="absolute left-full ml-1 top-0 bg-card border border-border rounded-lg shadow-lg py-1 z-20 min-w-[160px]"
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className={`flex items-center gap-2 w-full text-left text-xs font-medium px-3 py-2 transition-colors ${
                item.destructive ? 'text-destructive hover:bg-destructive/10' : 'text-foreground hover:bg-secondary'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
