import { i18n } from '@mimik/core/env';
import type { Guide } from '@mimik/core/guides/types';
import { formatDateShort } from '@mimik/ui/lib/utils';
import FaviconImg from '@mimik/ui/shared/FaviconImg';

interface GuideResult {
  guide: Guide;
  domain: string;
}

interface SearchResultsProps {
  results: GuideResult[];
  query: string;
  selected: number;
  onSelect: (guideId: string) => void;
  onHover: (index: number) => void;
}

export default function SearchResults({ results, query, selected, onSelect, onHover }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-purple">
          {query ? i18n.t('search_noMatchingGuides') : i18n.t('search_noGuidesYet')}
        </p>
      </div>
    );
  }

  return (
    <>
      {results.map((r, i) => (
        <div
          key={r.guide.id}
          className="flex items-center gap-3 cursor-pointer transition-colors"
          style={
            i === selected
              ? { background: 'var(--color-primary)', borderRadius: '8px', margin: '0 6px', padding: '10px 12px' }
              : { padding: '10px 16px' }
          }
          onClick={() => onSelect(r.guide.id)}
          onMouseEnter={() => onHover(i)}
        >
          <div
            className="w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold shrink-0 overflow-hidden"
            style={
              i === selected
                ? {
                    background: 'rgba(199,210,254,0.15)',
                    border: '1px solid rgba(199,210,254,0.2)',
                    color: 'var(--color-lavender)',
                  }
                : {
                    background: 'var(--color-secondary)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-muted-foreground)',
                  }
            }
          >
            <FaviconImg domain={r.domain} size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-[13px] font-medium truncate"
              style={{ color: i === selected ? 'var(--color-lavender)' : 'var(--color-foreground)' }}
            >
              {r.guide.title}
            </p>
            {r.guide.description && (
              <p
                className="text-[11px] mt-0.5 line-clamp-1"
                style={{ color: i === selected ? 'rgba(199,210,254,0.6)' : 'var(--color-muted-foreground)' }}
              >
                {r.guide.description}
              </p>
            )}
            <p
              className="text-[10px] mt-0.5"
              style={{ color: i === selected ? 'rgba(199,210,254,0.6)' : 'var(--color-muted-foreground)' }}
            >
              {r.guide.stepIds.length !== 1
                ? i18n.t('fullview_stepCountPlural', [String(r.guide.stepIds.length)])
                : i18n.t('fullview_stepCount', [String(r.guide.stepIds.length)])}{' '}
              · {formatDateShort(r.guide.updatedAt)}
            </p>
          </div>
        </div>
      ))}
    </>
  );
}
