import { i18n } from '@mimik/core/env';
import { formatDate } from '@mimik/core/export/utils';
import { Star } from 'lucide-react';
import { FaviconImg } from '../../common/components/FaviconImg';
import { ScreenshotView } from '../../guide/components/ScreenshotView';
import { navigate } from '../../navigation/lib/navigate';
import { useFullview } from '../../stores/use-fullview';
import { CardMenu } from './CardMenu';
import { MimikEyes } from './MimikEyes';

interface GuideGridViewProps {
  columns: number;
  thumbHeight: number | null;
  category: 'all' | 'starred' | 'trash';
  onStar: (e: React.MouseEvent, id: string) => void;
  onTrash: (e: React.MouseEvent, id: string) => void;
  onRestore: (e: React.MouseEvent, id: string) => void;
  onPermanentDelete: (e: React.MouseEvent, id: string) => void;
  onDuplicate: (e: React.MouseEvent, id: string) => void;
}

export function GuideGridView({
  columns,
  thumbHeight,
  category,
  onStar,
  onTrash,
  onRestore,
  onPermanentDelete,
  onDuplicate,
}: GuideGridViewProps) {
  const { guides, thumbnails, places } = useFullview((s) => ({
    guides: s.guides,
    thumbnails: s.thumbnails,
    places: s.places,
  }));

  return (
    <div className="grid gap-[18px]" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {guides.map((guide) => {
        const thumb = thumbnails.get(guide.id);
        const place = places.get(guide.id);
        return (
          <div
            key={guide.id}
            onClick={() => navigate({ page: 'guide', guideId: guide.id })}
            className="group rounded-xl bg-card cursor-pointer hover:shadow-md transition-shadow border border-border relative"
          >
            <div
              className={`relative overflow-hidden rounded-t-xl border-b border-secondary flex items-center ${thumbHeight === null ? 'aspect-video' : ''}`}
              style={thumbHeight === null ? undefined : { height: thumbHeight }}
            >
              {thumb ? (
                <ScreenshotView
                  screenshot={thumb}
                  alt={guide.title}
                  crop
                  cache
                  cover
                  className="!rounded-none !border-0 w-full"
                  readOnly
                />
              ) : (
                <MimikEyes />
              )}
              {guide.starred && (
                <span className="absolute right-2 top-2 flex items-center justify-center w-[26px] h-[26px] rounded-lg bg-card/90 shadow-sm text-foreground">
                  <Star size={13} fill="currentColor" />
                </span>
              )}
            </div>
            <div className="px-3.5 pt-3 pb-3.5 flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5 min-w-0 h-4 text-[11.5px] text-muted-foreground">
                {place ? (
                  <>
                    <FaviconImg domain={place.name} size={16} letterOnly={place.kind === 'app'} appId={place.id} />
                    <span className="truncate">{place.name}</span>
                  </>
                ) : (
                  <span>&mdash;</span>
                )}
              </span>
              <div className="flex items-start gap-2">
                <p className="flex-1 min-w-0 min-h-10 text-sm font-semibold leading-5 text-foreground line-clamp-2">
                  {guide.title}
                </p>
                <CardMenu
                  guideId={guide.id}
                  starred={guide.starred}
                  category={category}
                  onStar={onStar}
                  onTrash={onTrash}
                  onRestore={onRestore}
                  onPermanentDelete={onPermanentDelete}
                  onDuplicate={onDuplicate}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {guide.stepIds.length !== 1
                  ? i18n.t('fullview.stepCountPlural', [String(guide.stepIds.length)])
                  : i18n.t('fullview.stepCount', [String(guide.stepIds.length)])}{' '}
                &middot; {formatDate(guide.updatedAt)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
