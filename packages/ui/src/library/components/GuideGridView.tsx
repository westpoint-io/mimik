import { i18n } from '@mimik/core/env';
import { formatDate } from '@mimik/core/export/utils';
import ScreenshotView from '../../guide/components/ScreenshotView';
import { navigate } from '../../navigation/lib/navigate';
import { useFullview } from '../../stores/use-fullview';
import { CardMenu } from './CardMenu';
import { MimikEyes } from './MimikEyes';

interface GuideGridViewProps {
  category: 'all' | 'starred' | 'trash';
  onStar: (e: React.MouseEvent, id: string) => void;
  onTrash: (e: React.MouseEvent, id: string) => void;
  onRestore: (e: React.MouseEvent, id: string) => void;
  onPermanentDelete: (e: React.MouseEvent, id: string) => void;
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
