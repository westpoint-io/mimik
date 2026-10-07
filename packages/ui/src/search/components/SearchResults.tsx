import { i18n } from '@mimik/core/env';
import type { Guide, Screenshot } from '@mimik/core/guides/types';
import { CornerDownLeft } from 'lucide-react';
import { FaviconImg } from '../../common/components/FaviconImg';
import { formatDateShort } from '../../common/lib/format-date-short';
import { ScreenshotView } from '../../guide/components/ScreenshotView';
import { MimikEyes } from '../../library/components/MimikEyes';
import type { GuidePlace } from '../../library/types';
import { MatchText } from './MatchText';

interface SearchResultsProps {
  guides: Guide[];
  thumbnails: Map<string, Screenshot>;
  places: Map<string, GuidePlace>;
  query: string;
  selected: number;
  onSelect: (guideId: string) => void;
  onHover: (index: number) => void;
}

export function SearchResults({ guides, thumbnails, places, query, selected, onSelect, onHover }: SearchResultsProps) {
  return (
    <>
      {guides.map((guide, i) => {
        const thumb = thumbnails.get(guide.id);
        const place = places.get(guide.id);
        const active = i === selected;
        const steps = guide.stepIds.length;
        return (
          <button
            key={guide.id}
            type="button"
            onClick={() => onSelect(guide.id)}
            onMouseEnter={() => onHover(i)}
            className={`flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left ${active ? 'bg-secondary' : ''}`}
          >
            <div className="relative aspect-video w-16 shrink-0 overflow-hidden rounded-md border border-border [&_svg]:h-auto [&_svg]:w-9">
              {thumb ? (
                <ScreenshotView
                  screenshot={thumb}
                  alt=""
                  crop
                  cache
                  cover
                  className="!rounded-none !border-0 w-full"
                  readOnly
                />
              ) : (
                <MimikEyes />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="truncate text-[13.5px] font-semibold text-foreground">
                <MatchText text={guide.title || i18n.t('guide.untitled')} query={query} />
              </p>
              <p className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-muted-foreground">
                {place && (
                  <>
                    <FaviconImg domain={place.name} size={14} letterOnly={place.kind === 'app'} appId={place.id} />
                    <span className="truncate">{place.name}</span>
                    <span>&middot;</span>
                  </>
                )}
                <span className="shrink-0">
                  {steps === 1 ? i18n.t('guide.stepCount', ['1']) : i18n.t('guide.stepCountPlural', [String(steps)])}{' '}
                  &middot; {formatDateShort(guide.updatedAt)}
                </span>
              </p>
            </div>
            {active && <CornerDownLeft size={15} className="shrink-0 text-foreground" />}
          </button>
        );
      })}
    </>
  );
}
