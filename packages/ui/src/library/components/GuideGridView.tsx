import { i18n } from '@mimik/core/env';
import { formatDate } from '@mimik/ui/common/lib/utils';
import ScreenshotView from '@mimik/ui/guide/components/ScreenshotView';
import { useFullview } from '@mimik/ui/stores/fullview';
import { MoreVertical, RotateCcw, Star, StarOff, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { navigate } from '../../navigation/lib/router';

interface GuideGridViewProps {
  category: 'all' | 'starred' | 'trash';
  onStar: (e: React.MouseEvent, id: string) => void;
  onTrash: (e: React.MouseEvent, id: string) => void;
  onRestore: (e: React.MouseEvent, id: string) => void;
  onPermanentDelete: (e: React.MouseEvent, id: string) => void;
}

function MimikEyes() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-primary">
      <svg width="120" height="50" viewBox="0 0 120 50" fill="none">
        <path d="M15 30 Q27 14 39 30" stroke="#C7D2FE" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M81 30 Q93 14 105 30" stroke="#C7D2FE" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M39 44 Q60 54 81 44" stroke="#C7D2FE" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
}

function CardMenu({
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

export default function GuideGridView({ category, onStar, onTrash, onRestore, onPermanentDelete }: GuideGridViewProps) {
  const { guides, thumbnails } = useFullview((s) => ({
    guides: s.guides,
    thumbnails: s.thumbnails,
  }));

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      {guides.map((guide) => {
        const thumb = thumbnails.get(guide.id);
        return (
          <div
            key={guide.id}
            onClick={() => navigate({ page: 'guide', guideId: guide.id })}
            className="group rounded-xl bg-card cursor-pointer hover:shadow-md transition-shadow border border-border relative"
          >
            <div className="h-36 overflow-hidden rounded-t-xl">
              {thumb ? (
                <ScreenshotView screenshot={thumb} alt={guide.title} className="!rounded-none !border-0" readOnly />
              ) : (
                <MimikEyes />
              )}
            </div>
            <div className="p-3 flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate text-foreground">{guide.title}</p>
                {guide.description && (
                  <p className="text-xs mt-0.5 text-muted-foreground line-clamp-2">{guide.description}</p>
                )}
                <p className="text-xs mt-0.5 text-muted-foreground">
                  {guide.stepIds.length !== 1
                    ? i18n.t('fullview_stepCountPlural', [String(guide.stepIds.length)])
                    : i18n.t('fullview_stepCount', [String(guide.stepIds.length)])}{' '}
                  &middot; {formatDate(guide.updatedAt)}
                </p>
              </div>
              <CardMenu
                guideId={guide.id}
                starred={guide.starred}
                category={category}
                onStar={onStar}
                onTrash={onTrash}
                onRestore={onRestore}
                onPermanentDelete={onPermanentDelete}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
