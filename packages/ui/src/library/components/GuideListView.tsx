import { i18n } from '@mimik/core/env';
import { formatDate } from '@mimik/core/export/utils';
import { Star } from 'lucide-react';
import { FaviconImg } from '../../common/components/FaviconImg';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import { ScreenshotView } from '../../guide/components/ScreenshotView';
import { navigate } from '../../navigation/lib/navigate';
import { useFullview } from '../../stores/use-fullview';
import { CardMenu } from './CardMenu';
import { MimikEyes } from './MimikEyes';

interface GuideListViewProps {
  category: 'all' | 'starred' | 'trash';
  onStar: (e: React.MouseEvent, id: string) => void;
  onTrash: (e: React.MouseEvent, id: string) => void;
  onRestore: (e: React.MouseEvent, id: string) => void;
  onPermanentDelete: (e: React.MouseEvent, id: string) => void;
}

export function GuideListView({ category, onStar, onTrash, onRestore, onPermanentDelete }: GuideListViewProps) {
  const { guides, thumbnails, places } = useFullview((s) => ({
    guides: s.guides,
    thumbnails: s.thumbnails,
    places: s.places,
  }));

  return (
    <div className="flex flex-col gap-2.5">
      {guides.map((guide) => {
        const thumb = thumbnails.get(guide.id);
        const place = places.get(guide.id);
        return (
          <div
            key={guide.id}
            onClick={() => navigate({ page: 'guide', guideId: guide.id })}
            className="flex items-center gap-4 px-3 py-2.5 rounded-xl border border-border bg-card cursor-pointer transition-shadow hover:shadow-md"
          >
            <div className="relative w-32 aspect-video shrink-0 overflow-hidden rounded-md border border-secondary [&_svg]:w-16 [&_svg]:h-auto">
              {thumb ? (
                <ScreenshotView
                  screenshot={thumb}
                  alt={guide.title}
                  crop
                  cache
                  frameRatio={16 / 9}
                  className="!rounded-none !border-0"
                  readOnly
                />
              ) : (
                <MimikEyes />
              )}
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <p className="text-sm font-semibold truncate text-foreground">{guide.title}</p>
              {guide.description && <p className="text-xs text-muted-foreground truncate">{guide.description}</p>}
              <p className="flex items-center gap-1.5 min-w-0 text-[11.5px] text-muted-foreground">
                {place && (
                  <>
                    <FaviconImg domain={place.name} size={16} letterOnly={place.kind === 'app'} />
                    <span className="truncate">{place.name}</span>
                    <span>&middot;</span>
                  </>
                )}
                <span className="shrink-0">
                  {guide.stepIds.length !== 1
                    ? i18n.t('fullview_stepCountPlural', [String(guide.stepIds.length)])
                    : i18n.t('fullview_stepCount', [String(guide.stepIds.length)])}{' '}
                  &middot; {formatDate(guide.updatedAt)}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-0.5">
              {category !== 'trash' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => onStar(e, guide.id)}
                      className="p-1.5 rounded-lg transition-colors text-foreground hover:bg-secondary"
                    >
                      <Star size={15} fill={guide.starred ? 'currentColor' : 'none'} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{guide.starred ? i18n.t('common_unstar') : i18n.t('common_star')}</TooltipContent>
                </Tooltip>
              )}
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
