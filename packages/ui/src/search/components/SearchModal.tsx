import { i18n } from '@mimik/core/env';
import { getGuides } from '@mimik/core/guides/service';
import type { Guide, Screenshot } from '@mimik/core/guides/types';
import { Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MascotIcon } from '../../common/components/MascotIcon';
import { Dialog, DialogPortal } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { loadCardData } from '../../library/lib/load-card-data';
import type { GuidePlace } from '../../library/types';
import { navigate } from '../../navigation/lib/navigate';
import { useFullview } from '../../stores/use-fullview';
import { SearchResults } from './SearchResults';

const RECENT = 5;
const SHOWN = 8;

export function SearchModal() {
  const {
    searchOpen: open,
    setSearchOpen,
    toggleSearch,
  } = useFullview((s) => ({
    searchOpen: s.searchOpen,
    setSearchOpen: s.setSearchOpen,
    toggleSearch: s.toggleSearch,
  }));

  const [query, setQuery] = useState('');
  const [guides, setGuides] = useState<Guide[] | null>(null);
  const [thumbnails, setThumbnails] = useState(new Map<string, Screenshot>());
  const [places, setPlaces] = useState(new Map<string, GuidePlace>());
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleSearch();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleSearch]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelected(0);
    setGuides(null);
    void getGuides().then(setGuides);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const shown = useMemo(() => {
    if (!guides) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return guides.slice(0, RECENT);
    return guides.filter((g) => g.title.toLowerCase().includes(needle)).slice(0, SHOWN);
  }, [guides, query]);

  useEffect(() => {
    if (!shown.length) return;
    let live = true;
    void loadCardData(shown).then((data) => {
      if (!live) return;
      setThumbnails(data.thumbnails);
      setPlaces(data.places);
    });
    return () => {
      live = false;
    };
  }, [shown]);

  const handleSelect = useCallback(
    (guideId: string) => {
      setSearchOpen(false);
      navigate({ page: 'guide', guideId });
    },
    [setSearchOpen],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, shown.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (shown[selected]) handleSelect(shown[selected].id);
      }
    },
    [shown, selected, handleSelect],
  );

  const typed = query.trim();
  const heading = !typed
    ? i18n.t('search.recent')
    : shown.length === 1
      ? i18n.t('search.resultsOne')
      : i18n.t('search.results', [String(shown.length)]);

  return (
    <Dialog open={open} onOpenChange={setSearchOpen} modal={false}>
      <DialogPortal>
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-primary/25 px-4 pt-[12vh]"
          onClick={() => setSearchOpen(false)}
        >
          <div
            role="dialog"
            aria-label={i18n.t('library.searchPlaceholder')}
            className="w-full max-w-[620px] overflow-hidden rounded-2xl border border-border bg-card shadow-[0_30px_80px_rgba(30,27,75,0.3)]"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            <div className="flex h-[58px] items-center gap-3 border-b border-secondary px-[18px]">
              <Search size={19} className="shrink-0 text-foreground" />
              <Input
                ref={inputRef}
                placeholder={i18n.t('library.searchPlaceholder')}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelected(0);
                }}
                className="h-auto flex-1 border-0 bg-transparent p-0 text-base font-medium text-foreground shadow-none focus-visible:ring-0"
              />
            </div>
            {guides && shown.length > 0 && (
              <div className="px-2 pt-1.5 pb-2">
                <p className="px-3 pt-2.5 pb-1 text-[11px] font-semibold text-muted-foreground">{heading}</p>
                <SearchResults
                  guides={shown}
                  thumbnails={thumbnails}
                  places={places}
                  query={typed}
                  selected={selected}
                  onSelect={handleSelect}
                  onHover={setSelected}
                />
              </div>
            )}
            {guides && shown.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-6 pt-7 pb-8 text-center">
                <MascotIcon size={52} pose="lookaway" />
                <p className="text-sm font-semibold text-foreground">
                  {typed ? i18n.t('search.noMatch', [typed]) : i18n.t('search.noGuidesYet')}
                </p>
                {typed && <p className="text-[12.5px] text-muted-foreground">{i18n.t('search.noMatchHint')}</p>}
              </div>
            )}
          </div>
        </div>
      </DialogPortal>
    </Dialog>
  );
}
