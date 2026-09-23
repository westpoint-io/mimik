import { i18n } from '@mimik/core/env';
import { getGuideDomain, getGuides } from '@mimik/core/guides/service';
import type { Guide } from '@mimik/core/guides/types';
import { Search, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog, DialogPortal } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { navigate } from '../../navigation/lib/navigate';
import { useFullview } from '../../stores/use-fullview';
import KeyboardHints from './KeyboardHints';
import SearchResults from './SearchResults';

interface GuideResult {
  guide: Guide;
  domain: string;
}

export default function SearchModal() {
  const { searchOpen: open, setSearchOpen } = useFullview((s) => ({
    searchOpen: s.searchOpen,
    setSearchOpen: s.setSearchOpen,
  }));

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GuideResult[]>([]);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadResults = useCallback(async () => {
    const guides = await getGuides();
    const withFavicons = await Promise.all(
      guides.map(async (guide) => {
        const domain = await getGuideDomain(guide.id);
        return { guide, domain: domain || '' };
      }),
    );
    setResults(withFavicons);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      loadResults();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, loadResults]);

  const filtered = query ? results.filter((r) => r.guide.title.toLowerCase().includes(query.toLowerCase())) : [];

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
        setSelected((s) => Math.min(s + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selected]) handleSelect(filtered[selected].guide.id);
      }
    },
    [filtered, selected, handleSelect],
  );

  return (
    <Dialog open={open} onOpenChange={setSearchOpen} modal={false}>
      <DialogPortal>
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-[640px] rounded-xl overflow-hidden bg-card shadow-lg"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search size={18} className="text-accent shrink-0" />
              <Input
                ref={inputRef}
                placeholder={i18n.t('fullview_searchPlaceholder')}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelected(0);
                }}
                className="flex-1 text-[15px] font-medium border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 h-auto text-foreground"
              />
              {query && (
                <button onClick={() => setQuery('')} className="p-0.5 rounded text-purple">
                  <X size={14} />
                </button>
              )}
            </div>
            {filtered.length > 0 ? (
              <div className="max-h-[320px] overflow-y-auto py-1">
                <SearchResults
                  results={filtered}
                  query={query}
                  selected={selected}
                  onSelect={handleSelect}
                  onHover={setSelected}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center py-7 gap-2.5">
                <svg width="56" height="52" viewBox="0 0 56 52" fill="none">
                  <rect x="8" y="16" width="40" height="24" rx="3" fill="#1E1B4B" />
                  <path d="M8 16 L8 11 Q8 3, 28 3 Q48 3, 48 11 L48 16 Z" fill="#3730A3" />
                  <rect x="8" y="15" width="40" height="1.5" fill="#C7D2FE" />
                  <path d="M17 27 Q20.5 23 24 27" stroke="#C7D2FE" strokeWidth="2" fill="none" strokeLinecap="round" />
                  <path d="M22 36 Q28 40 34 36" stroke="#C7D2FE" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  <circle cx="38" cy="24" r="8" stroke="#4F46E5" strokeWidth="2" fill="none" />
                  <line x1="44" y1="30" x2="50" y2="36" stroke="#4F46E5" strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="38" cy="24" r="3" fill="#C7D2FE" />
                  <circle cx="39" cy="23.5" r="1" fill="#1E1B4B" />
                </svg>
                <span className="text-[13px] font-medium text-muted-foreground/50">{i18n.t('search_startTyping')}</span>
              </div>
            )}
            <KeyboardHints />
          </div>
        </div>
      </DialogPortal>
    </Dialog>
  );
}
