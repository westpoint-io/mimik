import { LayoutDashboard, Star, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { i18n } from '#imports';
import {
  type GuideChangeEvent,
  getGuideDomain,
  getGuides,
  onGuidesChanged,
  softDeleteGuide,
  toggleStar,
} from '@/core/guides/service';
import type { Guide } from '@/core/guides/types';
import { createTab, focusWindow, getExtensionURL, queryTabs, updateTab } from '@/lib/browser-api';
import { formatRelativeTime } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/components/ui/tooltip';
import FaviconImg from '@/ui/shared/FaviconImg';

async function openDashboard() {
  const url = getExtensionURL('/fullview.html');
  const tabs = await queryTabs({ url });
  const existing = tabs[0];
  if (existing?.id) {
    await updateTab(existing.id, { active: true });
    if (existing.windowId) await focusWindow(existing.windowId);
  } else {
    await createTab({ url });
  }
}

interface LibraryViewProps {
  onOpen: (guideId: string) => void;
  onStartRecording?: () => void;
  isAlive?: boolean;
  searchQuery?: string;
}

interface GuideWithMeta extends Guide {
  domain: string;
}

export default function LibraryView({ onOpen, searchQuery = '' }: LibraryViewProps) {
  const [guides, setGuides] = useState<GuideWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const loadGuides = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getGuides();
      const withMeta: GuideWithMeta[] = await Promise.all(
        result.map(async (guide) => {
          const domain = await getGuideDomain(guide.id);
          return {
            ...guide,
            domain,
          };
        }),
      );
      setGuides(withMeta);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGuides();
  }, [loadGuides]);

  useEffect(
    () =>
      onGuidesChanged((event: GuideChangeEvent) => {
        if (event.type === 'starred') {
          setGuides((prev) => prev.map((g) => (g.id === event.id ? { ...g, starred: event.starred } : g)));
        } else {
          loadGuides();
        }
      }),
    [loadGuides],
  );

  const handleStar = useCallback(async (e: React.MouseEvent, guideId: string) => {
    e.stopPropagation();
    setGuides((prev) => prev.map((g) => (g.id === guideId ? { ...g, starred: !g.starred } : g)));
    await toggleStar(guideId);
  }, []);

  const handleDelete = useCallback(
    async (e: React.MouseEvent, guideId: string) => {
      e.stopPropagation();
      await softDeleteGuide(guideId);
      await loadGuides();
    },
    [loadGuides],
  );

  const filtered = searchQuery
    ? guides.filter((g) => g.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : guides;

  if (loading) {
    return <p className="text-sm py-4 text-purple">{i18n.t('common.loading')}</p>;
  }

  if (guides.length === 0) {
    return (
      <div className="py-10 text-center flex flex-col items-center">
        <svg viewBox="0 0 200 200" className="w-20 h-20 animate-[float_3s_ease-in-out_infinite]">
          <style>{`
            @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
            @keyframes sparkle{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}
          `}</style>
          <circle cx="45" cy="80" r="3" fill="#818CF8" style={{ animation: 'sparkle 1.5s ease-in-out infinite' }} />
          <circle
            cx="160"
            cy="70"
            r="2.5"
            fill="#818CF8"
            style={{ animation: 'sparkle 1.5s ease-in-out infinite 0.3s' }}
          />
          <circle
            cx="50"
            cy="140"
            r="2"
            fill="#A5B4FC"
            style={{ animation: 'sparkle 1.5s ease-in-out infinite 0.6s' }}
          />
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
        <p className="text-sm font-medium text-foreground mt-3">{i18n.t('library.noGuidesTitle')}</p>
        <p className="text-xs mt-1 text-purple">{i18n.t('library.noGuidesSub')}</p>
        <button
          type="button"
          onClick={() => void openDashboard()}
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-foreground px-3 py-1.5 rounded-lg border border-border bg-card hover:border-violet hover:text-purple transition-colors"
        >
          <LayoutDashboard size={13} />
          {i18n.t('library.openDashboard')}
        </button>
        <p className="text-[11px] mt-2 text-muted-foreground">{i18n.t('library.openDashboardHint')}</p>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-purple">{i18n.t('library.noMatchingGuides')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 px-1 pb-4">
      {filtered.map((guide) => {
        const isEmpty = guide.stepIds.length === 0;
        return (
          <div
            key={guide.id}
            className="flex items-start gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer group transition-all bg-card border border-border hover:border-violet hover:shadow-sm"
            onClick={() => onOpen(guide.id)}
          >
            <div className="w-7 h-7 mt-0.5 rounded-full flex items-center justify-center shrink-0 overflow-hidden">
              <FaviconImg domain={guide.domain} size={20} />
            </div>

            <div className="flex-1 min-w-0">
              <p className={`text-[13px] font-medium truncate ${isEmpty ? 'text-[#8B92A8]' : 'text-foreground'}`}>
                {guide.title}
              </p>
              {guide.description && (
                <p className="text-[11px] mt-0.5 text-muted-foreground line-clamp-1">{guide.description}</p>
              )}
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-[#8B92A8]">{formatRelativeTime(guide.updatedAt)}</span>
                {guide.stepIds.length > 0 && (
                  <span className="text-[9px] font-semibold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full leading-none">
                    {guide.stepIds.length !== 1
                      ? i18n.t('fullview.stepCountPlural', [String(guide.stepIds.length)])
                      : i18n.t('fullview.stepCount', [String(guide.stepIds.length)])}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => handleStar(e, guide.id)}
                    className={`p-1.5 rounded-lg transition-all hover:text-accent ${guide.starred ? 'text-accent' : 'text-border'}`}
                  >
                    <Star size={13} fill={guide.starred ? 'currentColor' : 'none'} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{guide.starred ? i18n.t('common.unstar') : i18n.t('common.star')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => handleDelete(e, guide.id)}
                    className="p-1.5 rounded-lg transition-all text-border hover:text-destructive"
                  >
                    <Trash2 size={13} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{i18n.t('library.moveToTrash')}</TooltipContent>
              </Tooltip>
            </div>
          </div>
        );
      })}
    </div>
  );
}
