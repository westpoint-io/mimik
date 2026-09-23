import { i18n } from '@mimik/core/env';
import { formatDate } from '@mimik/ui/common/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mimik/ui/components/ui/tooltip';
import { useFullview } from '@mimik/ui/stores/fullview';
import { RotateCcw, Star, Trash2 } from 'lucide-react';
import { navigate } from '../../navigation/lib/router';

interface GuideListViewProps {
  category: 'all' | 'starred' | 'trash';
  onStar: (e: React.MouseEvent, id: string) => void;
  onTrash: (e: React.MouseEvent, id: string) => void;
  onRestore: (e: React.MouseEvent, id: string) => void;
  onPermanentDelete: (e: React.MouseEvent, id: string) => void;
}

export default function GuideListView({ category, onStar, onTrash, onRestore, onPermanentDelete }: GuideListViewProps) {
  const { guides } = useFullview((s) => ({ guides: s.guides }));

  return (
    <div className="rounded-xl overflow-hidden bg-card border border-border">
      {guides.map((guide, idx) => (
        <div
          key={guide.id}
          onClick={() => navigate({ page: 'guide', guideId: guide.id })}
          className="flex items-center px-5 py-3.5 cursor-pointer transition-colors group hover:bg-secondary"
          style={{ borderBottom: idx < guides.length - 1 ? '1px solid var(--color-border)' : undefined }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-foreground">{guide.title}</p>
            {guide.description && (
              <p className="text-xs mt-0.5 text-muted-foreground line-clamp-1">{guide.description}</p>
            )}
            <p className="text-xs mt-0.5 text-muted-foreground">
              {guide.stepIds.length !== 1
                ? i18n.t('fullview_stepCountPlural', [String(guide.stepIds.length)])
                : i18n.t('fullview_stepCount', [String(guide.stepIds.length)])}{' '}
              &middot; {formatDate(guide.updatedAt)}
            </p>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity motion-reduce:transition-none">
            {category !== 'trash' ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => onStar(e, guide.id)}
                      className="p-1.5 rounded-lg transition-colors text-purple hover:text-accent"
                    >
                      <Star size={14} fill={guide.starred ? 'currentColor' : 'none'} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{guide.starred ? i18n.t('common_unstar') : i18n.t('common_star')}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => onTrash(e, guide.id)}
                      className="p-1.5 rounded-lg transition-colors text-purple hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent align="end">{i18n.t('library_moveToTrash')}</TooltipContent>
                </Tooltip>
              </>
            ) : (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => onRestore(e, guide.id)}
                      className="p-1.5 rounded-lg transition-colors text-purple hover:text-success"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{i18n.t('common_restore')}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => onPermanentDelete(e, guide.id)}
                      className="p-1.5 rounded-lg transition-colors text-purple hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent align="end">{i18n.t('library_deletePermanently')}</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
