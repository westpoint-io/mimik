import {
  ArrowDownWideNarrow,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  LayoutList,
  Upload,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { i18n } from '#imports';
import {
  type GuideChangeEvent,
  getFirstScreenshot,
  getGuides,
  getStarredGuides,
  getTrashedGuides,
  onGuidesChanged,
  permanentlyDeleteGuide,
  restoreGuide,
  softDeleteGuide,
  toggleStar,
} from '@/core/guides/service';
import type { Guide, Screenshot } from '@/core/guides/types';
import { BUNDLE_EXTENSION } from '@/core/transfer/schema';
import { useFullview } from '@/stores/fullview';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/components/ui/tooltip';
import ConfirmDeleteModal from './components/ConfirmDeleteModal';
import GuideGridView from './components/GuideGridView';
import GuideListView from './components/GuideListView';
import ImportGuideModal from './components/ImportGuideModal';
import { navigate } from './router';

interface LibraryContentProps {
  category: 'all' | 'starred' | 'trash';
}

const emptyConfig: Record<string, { titleKey: string; subKey: string }> = {
  all: { titleKey: 'library_noGuidesTitle', subKey: 'library_noGuidesSub' },
  starred: { titleKey: 'library_noStarredTitle', subKey: 'library_noStarredSub' },
  trash: { titleKey: 'library_trashEmptyTitle', subKey: 'library_trashEmptySub' },
};

function EmptyMascot({ category }: { category: string }) {
  if (category === 'starred') return <StarredMascot />;
  if (category === 'trash') return <TrashMascot />;
  return <NoGuidesMascot />;
}

function NoGuidesMascot() {
  return (
    <svg viewBox="0 0 200 200" className="w-24 h-24 animate-[float_3s_ease-in-out_infinite]">
      <style>{`
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes sparkle{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}
      `}</style>
      <circle cx="45" cy="80" r="3" fill="#818CF8" style={{ animation: 'sparkle 1.5s ease-in-out infinite' }} />
      <circle cx="160" cy="70" r="2.5" fill="#818CF8" style={{ animation: 'sparkle 1.5s ease-in-out infinite 0.3s' }} />
      <circle cx="50" cy="140" r="2" fill="#A5B4FC" style={{ animation: 'sparkle 1.5s ease-in-out infinite 0.6s' }} />
      <circle
        cx="155"
        cy="145"
        r="2.5"
        fill="#818CF8"
        style={{ animation: 'sparkle 1.5s ease-in-out infinite 0.9s' }}
      />
      <circle cx="100" cy="110" r="50" fill="#C7D2FE" />
      <rect x="58" y="110" width="84" height="40" rx="5" fill="#1E1B4B" />
      <path d="M58 110 L58 98 Q58 82 100 82 Q142 82 142 98 L142 110Z" fill="#3730A3" />
      <path d="M58 110 L58 98 Q58 82 100 82 Q142 82 142 98 L142 110Z" fill="#4F46E5" />
      <rect x="58" y="109" width="84" height="2" fill="#C7D2FE" />
      <path d="M82 126 Q88 118 94 126" stroke="#C7D2FE" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M106 126 Q112 118 118 126" stroke="#C7D2FE" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M90 138 Q100 146 110 138" stroke="#C7D2FE" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function StarredMascot() {
  return (
    <svg viewBox="0 0 200 200" className="w-24 h-24">
      <style>{`
        @keyframes twinkle{0%,100%{opacity:.4;transform:scale(.9)}50%{opacity:1;transform:scale(1.15)}}
      `}</style>
      <circle cx="100" cy="115" r="50" fill="#C7D2FE" />
      <rect x="58" y="115" width="84" height="40" rx="5" fill="#1E1B4B" />
      <path d="M58 115 L58 103 Q58 87 100 87 Q142 87 142 103 L142 115Z" fill="#3730A3" />
      <path d="M58 115 L58 103 Q58 87 100 87 Q142 87 142 103 L142 115Z" fill="#4F46E5" />
      <rect x="58" y="114" width="84" height="2" fill="#C7D2FE" />
      <path d="M82 131 Q88 124 94 131" stroke="#C7D2FE" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M106 131 Q112 124 118 131" stroke="#C7D2FE" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M92 143 Q100 150 108 143" stroke="#C7D2FE" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <g style={{ animation: 'twinkle 1.5s ease-in-out infinite' }}>
        <polygon
          points="155,70 159,80 170,81 162,88 164,99 155,93 146,99 148,88 140,81 151,80"
          fill="#FBBF24"
          stroke="#F59E0B"
          strokeWidth="1"
        />
      </g>
      <line x1="142" y1="120" x2="153" y2="90" stroke="#C7D2FE" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function TrashMascot() {
  return (
    <svg viewBox="0 0 200 200" className="w-24 h-24">
      <style>{`
        @keyframes sweep{0%,100%{transform:rotate(-10deg)}50%{transform:rotate(10deg)}}
        @keyframes sparkle{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}
      `}</style>
      <circle cx="100" cy="115" r="50" fill="#C7D2FE" />
      <rect x="58" y="115" width="84" height="40" rx="5" fill="#1E1B4B" />
      <path d="M58 115 L58 103 Q58 87 100 87 Q142 87 142 103 L142 115Z" fill="#3730A3" />
      <path d="M58 115 L58 103 Q58 87 100 87 Q142 87 142 103 L142 115Z" fill="#4F46E5" />
      <rect x="58" y="114" width="84" height="2" fill="#C7D2FE" />
      <path d="M82 131 Q88 124 94 131" stroke="#C7D2FE" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M106 131 Q112 124 118 131" stroke="#C7D2FE" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M92 143 Q100 150 108 143" stroke="#C7D2FE" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <g style={{ transformOrigin: '155px 130px', animation: 'sweep 1.5s ease-in-out infinite' }}>
        <line x1="155" y1="75" x2="155" y2="140" stroke="#A5B4FC" strokeWidth="3" strokeLinecap="round" />
        <path d="M147 140 Q155 135 163 140 L160 155 Q155 158 150 155Z" fill="#818CF8" />
      </g>
      <circle cx="165" cy="155" r="2" fill="#818CF8" style={{ animation: 'sparkle 1s ease-in-out infinite' }} />
      <circle cx="148" cy="160" r="1.5" fill="#818CF8" style={{ animation: 'sparkle 1s ease-in-out infinite 0.3s' }} />
    </svg>
  );
}

type SortKey = 'recent' | 'oldest' | 'alpha' | 'steps';
const sortLabelKeys: Record<SortKey, string> = {
  recent: 'sort_recentFirst',
  oldest: 'sort_oldestFirst',
  alpha: 'sort_alphaAZ',
  steps: 'sort_mostSteps',
};

const PAGE_SIZE = 9;

function sortGuides(guides: Guide[], sort: SortKey): Guide[] {
  const sorted = [...guides];
  switch (sort) {
    case 'recent':
      return sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    case 'oldest':
      return sorted.sort((a, b) => a.updatedAt - b.updatedAt);
    case 'alpha':
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case 'steps':
      return sorted.sort((a, b) => b.stepIds.length - a.stepIds.length);
  }
}

export default function LibraryContent({ category }: LibraryContentProps) {
  const {
    setGuides,
    updateGuide,
    setThumbnails,
    libraryLoading: loading,
    setLibraryLoading: setLoading,
    setCounts,
  } = useFullview((s) => ({
    setGuides: s.setGuides,
    updateGuide: s.updateGuide,
    setThumbnails: s.setThumbnails,
    libraryLoading: s.libraryLoading,
    setLibraryLoading: s.setLibraryLoading,
    setCounts: s.setCounts,
  }));

  const [display, setDisplay] = useState<'list' | 'grid'>(
    () => (localStorage.getItem('mimik-display') as 'list' | 'grid') || 'grid',
  );
  const [sort, setSort] = useState<SortKey>('recent');
  const [sortOpen, setSortOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const allGuidesRef = useRef<Guide[]>([]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const refreshCounts = useCallback(async () => {
    const [all, starred, trashed] = await Promise.all([getGuides(), getStarredGuides(), getTrashedGuides()]);
    setCounts({ all: all.length, starred: starred.length, trash: trashed.length });
  }, [setCounts]);

  const loadGuides = useCallback(async () => {
    setLoading(true);
    const [all, starred, trashed] = await Promise.all([getGuides(), getStarredGuides(), getTrashedGuides()]);
    setCounts({ all: all.length, starred: starred.length, trash: trashed.length });

    const current = category === 'starred' ? starred : category === 'trash' ? trashed : all;
    allGuidesRef.current = current;

    const sorted = sortGuides(current, sort);
    const paged = sorted.slice(0, PAGE_SIZE);
    setGuides(paged);
    setPage(0);

    const thumbMap = new Map<string, Screenshot>();
    for (const guide of current.slice(0, 20)) {
      const screenshot = await getFirstScreenshot(guide.id);
      if (screenshot) thumbMap.set(guide.id, screenshot);
    }
    setThumbnails(thumbMap);
    setLoading(false);
  }, [category, sort, setCounts, setGuides, setThumbnails, setLoading]);

  useEffect(() => {
    loadGuides();
  }, [loadGuides]);

  useEffect(
    () =>
      onGuidesChanged((event: GuideChangeEvent) => {
        if (event.type === 'starred') {
          updateGuide(event.id, { starred: event.starred });
          refreshCounts();
        } else {
          loadGuides();
        }
      }),
    [refreshCounts, loadGuides, updateGuide],
  );

  const totalPages = Math.ceil(allGuidesRef.current.length / PAGE_SIZE);

  const applyPage = useCallback(
    async (newPage: number) => {
      const sorted = sortGuides(allGuidesRef.current, sort);
      const start = newPage * PAGE_SIZE;
      const paged = sorted.slice(start, start + PAGE_SIZE);
      setGuides(paged);
      setPage(newPage);

      const thumbMap = new Map<string, Screenshot>();
      for (const guide of paged) {
        const screenshot = await getFirstScreenshot(guide.id);
        if (screenshot) thumbMap.set(guide.id, screenshot);
      }
      setThumbnails(thumbMap);
    },
    [sort, setGuides, setThumbnails],
  );

  const handleSort = (key: SortKey) => {
    setSort(key);
    setSortOpen(false);
    const sorted = sortGuides(allGuidesRef.current, key);
    setGuides(sorted.slice(0, PAGE_SIZE));
    setPage(0);
  };

  const toggleDisplay = () => {
    const next = display === 'list' ? 'grid' : 'list';
    setDisplay(next);
    localStorage.setItem('mimik-display', next);
  };

  const handleStar = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const guide = allGuidesRef.current.find((g) => g.id === id);
    if (guide) updateGuide(id, { starred: !guide.starred });
    await toggleStar(id);
    await refreshCounts();
  };
  const handleTrash = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await softDeleteGuide(id);
    await loadGuides();
  };
  const handleRestore = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await restoreGuide(id);
    await loadGuides();
  };
  const handlePermanentDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteTarget(id);
  };
  const confirmPermanentDelete = async () => {
    if (!deleteTarget) return;
    setDeleteTarget(null);
    await permanentlyDeleteGuide(deleteTarget);
    await loadGuides();
  };

  const bundleFrom = (list: FileList | null): File | null => {
    const files = Array.from(list ?? []);
    if (files.length === 0) return null;
    return files.find((f) => f.name.toLowerCase().endsWith(`.${BUNDLE_EXTENSION}`)) ?? files[0];
  };

  const handleDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    dragDepth.current += 1;
    setDragging(true);
  };
  const handleDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    setImportFile(bundleFrom(e.dataTransfer.files));
  };

  const showPagination = !loading && allGuidesRef.current.length > PAGE_SIZE;

  return (
    <div
      className="relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) e.preventDefault();
      }}
      onDrop={handleDrop}
    >
      {dragging && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-accent bg-secondary/90 pointer-events-none">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-accent">
            <Upload size={16} />
            {i18n.t('import.dropHere')}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 mb-4">
        <input
          ref={fileRef}
          type="file"
          accept={`.${BUNDLE_EXTENSION}`}
          className="hidden"
          onChange={(e) => {
            setImportFile(bundleFrom(e.target.files));
            e.target.value = '';
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground px-3 py-1.5 rounded-lg border border-border bg-card hover:border-violet hover:text-purple transition-colors"
        >
          <Upload size={13} />
          {i18n.t('import.button')}
        </button>
        <div ref={sortRef} className="relative">
          <button
            onClick={() => setSortOpen(!sortOpen)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground px-3 py-1.5 rounded-lg border border-border bg-card hover:border-violet hover:text-purple transition-colors"
          >
            <ArrowDownWideNarrow size={13} />
            {i18n.t(sortLabelKeys[sort] as any)}
            <ChevronDown size={10} className="ml-0.5" />
          </button>
          {sortOpen && (
            <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
              {(Object.keys(sortLabelKeys) as SortKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => handleSort(key)}
                  className={`w-full text-left text-xs font-medium px-3 py-2 transition-colors ${
                    sort === key
                      ? 'text-foreground bg-secondary'
                      : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                  }`}
                >
                  {i18n.t(sortLabelKeys[key] as any)}
                </button>
              ))}
            </div>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleDisplay}
              className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-card text-muted-foreground hover:border-violet hover:text-purple transition-colors"
            >
              {display === 'list' ? <LayoutGrid size={15} /> : <LayoutList size={15} />}
            </button>
          </TooltipTrigger>
          <TooltipContent align="end">
            {display === 'list' ? i18n.t('sort_gridView') : i18n.t('sort_listView')}
          </TooltipContent>
        </Tooltip>
      </div>

      {loading ? (
        <p className="text-sm py-12 text-center text-purple">{i18n.t('common_loading')}</p>
      ) : allGuidesRef.current.length === 0 ? (
        <div className="text-center py-20 flex flex-col items-center">
          <EmptyMascot category={category} />
          <p className="text-lg font-medium text-foreground mt-4">{i18n.t(emptyConfig[category].titleKey as any)}</p>
          <p className="text-sm text-muted-foreground mt-1">{i18n.t(emptyConfig[category].subKey as any)}</p>
        </div>
      ) : display === 'list' ? (
        <GuideListView
          category={category}
          onStar={handleStar}
          onTrash={handleTrash}
          onRestore={handleRestore}
          onPermanentDelete={handlePermanentDelete}
        />
      ) : (
        <GuideGridView
          category={category}
          onStar={handleStar}
          onTrash={handleTrash}
          onRestore={handleRestore}
          onPermanentDelete={handlePermanentDelete}
        />
      )}

      {showPagination && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => applyPage(page - 1)}
            disabled={page === 0}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-card text-muted-foreground hover:border-violet hover:text-purple transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="text-xs font-medium text-muted-foreground">
            {i18n.t('fullview_pageOf', [String(page + 1), String(totalPages)])}
          </span>
          <button
            onClick={() => applyPage(page + 1)}
            disabled={page >= totalPages - 1}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-card text-muted-foreground hover:border-violet hover:text-purple transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}
      <ConfirmDeleteModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmPermanentDelete}
      />
      <ImportGuideModal
        file={importFile}
        onClose={() => setImportFile(null)}
        onImported={(guideId) => {
          setImportFile(null);
          navigate({ page: 'guide', guideId });
        }}
      />
    </div>
  );
}
