import { i18n } from '@mimik/core/env';
import {
  type GuideChangeEvent,
  getGuides,
  onGuidesChanged,
  softDeleteGuide,
  toggleStar,
} from '@mimik/core/guides/service';
import type { Guide } from '@mimik/core/guides/types';
import { Button } from '@mimik/ui/components/ui/button';
import { Input } from '@mimik/ui/components/ui/input';
import { formatRelativeTime, getDomainInitial } from '@mimik/ui/lib/utils';
import MascotIcon from '@mimik/ui/shared/MascotIcon';
import { Search, Star, Trash2, Video } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export default function HomeScreen({ onOpen, onStart }: { onOpen(guideId: string): void; onStart(): void }) {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setGuides(await getGuides());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(
    () =>
      onGuidesChanged((event: GuideChangeEvent) => {
        if (event.type === 'starred') {
          setGuides((prev) => prev.map((g) => (g.id === event.id ? { ...g, starred: event.starred } : g)));
        } else {
          load();
        }
      }),
    [load],
  );

  const star = async (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    setGuides((prev) => prev.map((g) => (g.id === id ? { ...g, starred: !g.starred } : g)));
    await toggleStar(id);
  };

  const trash = async (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    await softDeleteGuide(id);
    await load();
  };

  const filtered = query ? guides.filter((g) => g.title.toLowerCase().includes(query.toLowerCase())) : guides;

  return (
    <div className="flex flex-1 flex-col">
      <section className="flex flex-col items-center gap-3.5 border-b border-border bg-secondary px-7 py-9">
        <MascotIcon size={68} />
        <div className="text-center">
          <h1 className="text-[22px] font-semibold text-foreground">{i18n.t('sidepanel_heroTitle')}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{i18n.t('sidepanel_heroSubtitle')}</p>
        </div>
        <Button size="lg" className="mt-1 h-auto rounded-xl px-8 py-3.5 text-[15px] font-semibold" onClick={onStart}>
          <Video size={19} />
          {i18n.t('sidepanel_startCapture')}
        </Button>
      </section>

      <div className="flex flex-1 flex-col gap-4 px-10 pb-7 pt-6">
        <div className="flex items-center gap-3.5">
          <div className="relative w-[340px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-accent" />
            <Input
              type="search"
              aria-label={i18n.t('sidepanel_searchPlaceholder')}
              placeholder={i18n.t('sidepanel_searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="rounded-xl pl-10 !text-[13px]"
            />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {i18n.t('sidepanel_recentLabel')} &middot;{' '}
            {filtered.length === 1
              ? i18n.t('desktop_guideCount', [String(filtered.length)])
              : i18n.t('desktop_guideCountPlural', [String(filtered.length)])}
          </p>
        </div>

        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {query ? i18n.t('library_noMatchingGuides') : i18n.t('library_noGuidesSub')}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((guide) => {
              const { letter, gradient } = getDomainInitial(guide.title || '?');
              return (
                <div
                  key={guide.id}
                  className="flex items-center gap-3.5 rounded-[13px] border border-border bg-card px-4 py-3.5 transition-colors focus-within:border-accent hover:border-accent"
                >
                  <button
                    type="button"
                    onClick={() => onOpen(guide.id)}
                    className="flex min-w-0 flex-1 items-center gap-3.5 text-left"
                  >
                    <span
                      className="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] text-sm font-semibold text-white"
                      style={{ background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})` }}
                      aria-hidden="true"
                    >
                      {letter}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-foreground">{guide.title}</span>
                      <span className="mt-1 flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">{formatRelativeTime(guide.updatedAt)}</span>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold leading-none text-accent">
                          {guide.stepIds.length !== 1
                            ? i18n.t('fullview_stepCountPlural', [String(guide.stepIds.length)])
                            : i18n.t('fullview_stepCount', [String(guide.stepIds.length)])}
                        </span>
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={guide.starred ? i18n.t('common_unstar') : i18n.t('common_star')}
                    onClick={(e) => star(e, guide.id)}
                    className={`rounded-lg p-1.5 transition-colors hover:text-accent ${guide.starred ? 'text-accent' : 'text-border'}`}
                  >
                    <Star size={15} fill={guide.starred ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    type="button"
                    aria-label={i18n.t('library_moveToTrash')}
                    onClick={(e) => trash(e, guide.id)}
                    className="rounded-lg p-1.5 text-border transition-colors hover:text-destructive"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
