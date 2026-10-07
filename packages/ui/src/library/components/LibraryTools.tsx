import { i18n } from '@mimik/core/env';
import { BUNDLE_EXTENSION } from '@mimik/core/transfer/schema';
import { ArrowDownWideNarrow, ChevronDown, LayoutGrid, LayoutList, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import { useFullview } from '../../stores/use-fullview';
import { bundleFrom } from '../lib/bundle-from';
import type { SortKey } from '../types';

const sortLabelKeys: Record<SortKey, string> = {
  recent: 'sort_recentFirst',
  oldest: 'sort_oldestFirst',
  alpha: 'sort_alphaAZ',
  steps: 'sort_mostSteps',
};

export function LibraryTools() {
  const { sort, setSort, display, setDisplay, setImportFile } = useFullview((s) => ({
    sort: s.sort,
    setSort: s.setSort,
    display: s.display,
    setDisplay: s.setDisplay,
    setImportFile: s.setImportFile,
  }));
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="flex items-center gap-2">
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
        className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground px-3 h-8 rounded-lg border border-border bg-card hover:border-violet hover:text-purple transition-colors"
      >
        <Upload size={13} />
        {i18n.t('import.button')}
      </button>
      <div ref={sortRef} className="relative">
        <button
          onClick={() => setSortOpen(!sortOpen)}
          className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground px-3 h-8 rounded-lg border border-border bg-card hover:border-violet hover:text-purple transition-colors"
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
                onClick={() => {
                  setSort(key);
                  setSortOpen(false);
                }}
                className={`w-full text-left text-[13px] font-medium px-3 py-2 transition-colors ${
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
            onClick={() => setDisplay(display === 'list' ? 'grid' : 'list')}
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
  );
}
