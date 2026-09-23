import { i18n } from '@mimik/core/env';
import { diffSnapshots, type SnapshotDiff, type SnapshotLike } from '@mimik/core/guides/snapshot-diff';
import { groupSnapshots } from '@mimik/core/guides/snapshot-groups';
import type { Snapshot } from '@mimik/core/guides/types';
import { ChevronRight, MoreVertical, RotateCcw, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatDateTime } from '../../common/lib/format-date-time';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { useSnapshots } from '../hooks/use-snapshots';
import { changeSummary } from '../lib/change-summary';
import { filterPill } from '../lib/filter-pill';

interface VersionHistoryPanelProps {
  guideId: string;
  selectedId: string | null;
  refreshKey: number;
  live: SnapshotLike;
  onSelect: (snapshot: Snapshot | null) => void;
  onRestored: () => void;
  onClose: () => void;
}

export function VersionHistoryPanel({
  guideId,
  selectedId,
  refreshKey,
  live,
  onSelect,
  onRestored,
  onClose,
}: VersionHistoryPanelProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [namedOnly, setNamedOnly] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const renamingRef = useRef<string | null>(null);
  const clearRenaming = useCallback(() => {
    renamingRef.current = null;
    setRenamingId(null);
  }, []);
  const history = useSnapshots(guideId, refreshKey, clearRenaming);
  const snapshots = history.list;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId) inputRef.current?.focus();
  }, [renamingId]);

  const diffs = useMemo(() => {
    const map = new Map<string, SnapshotDiff>();
    snapshots.forEach((snapshot, i) => {
      const older = snapshots[i + 1];
      if (older) map.set(snapshot.id, diffSnapshots(older, snapshot));
    });
    return map;
  }, [snapshots]);

  const currentSummary = useMemo(
    () => (snapshots.length > 0 ? changeSummary(diffSnapshots(snapshots[0], live)) : ''),
    [snapshots, live],
  );

  const named = useMemo(() => snapshots.filter((s) => s.name), [snapshots]);

  const handleRestore = async (snapshot: Snapshot) => {
    const done = await history.restore(snapshot, () => {
      setExpanded(new Set());
      clearRenaming();
      onSelect(null);
      onRestored();
    });
    if (!done) return;
  };

  const startRename = (snapshot: Snapshot) => {
    renamingRef.current = snapshot.id;
    setRenamingId(snapshot.id);
    setDraft(snapshot.name ?? '');
  };

  const cancelRename = () => {
    renamingRef.current = null;
    setRenamingId(null);
  };

  const commitRename = async (snapshot: Snapshot) => {
    if (renamingRef.current !== snapshot.id) return;
    renamingRef.current = null;
    setRenamingId(null);
    const trimmed = draft.trim();
    const name = trimmed === '' ? undefined : trimmed;
    if (name === snapshot.name) return;
    await history.rename(snapshot, name);
  };

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const entry = (snapshot: Snapshot) => {
    const active = selectedId === snapshot.id;
    const diff = diffs.get(snapshot.id);
    const summary = diff ? changeSummary(diff) : '';
    return (
      <div key={snapshot.id} className="relative pl-5 py-2.5">
        <span
          className={`absolute left-0 top-4 w-2 h-2 rounded-full border-2 ${
            active ? 'bg-accent border-accent' : 'bg-card border-border'
          }`}
        />
        <div className="flex items-start gap-1">
          <div className="flex-1 min-w-0">
            {renamingId === snapshot.id ? (
              <input
                ref={inputRef}
                value={draft}
                placeholder={i18n.t('history.namePlaceholder')}
                aria-label={i18n.t('history.namePlaceholder')}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void commitRename(snapshot);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelRename();
                  }
                }}
                onBlur={() => void commitRename(snapshot)}
                className="w-full text-[12px] font-semibold text-foreground bg-card border border-accent rounded px-1.5 py-0.5 focus:outline-none"
              />
            ) : (
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(active ? null : snapshot)}
                className={`block w-full text-left text-[12px] ${
                  active ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className="block truncate">{snapshot.name || formatDateTime(snapshot.createdAt)}</span>
                {snapshot.name && (
                  <span className="block text-[10px] font-normal text-muted-foreground mt-0.5">
                    {formatDateTime(snapshot.createdAt)}
                  </span>
                )}
              </button>
            )}
            {summary && <p className="text-[10px] text-muted-foreground mt-0.5">{summary}</p>}
            {active && (
              <button
                type="button"
                disabled={history.restoring}
                onClick={() => void handleRestore(snapshot)}
                className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-semibold text-accent disabled:opacity-50"
              >
                <RotateCcw size={11} />
                {i18n.t('history.restore')}
              </button>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={i18n.t('history.nameVersion')}
                className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground"
              >
                <MoreVertical size={13} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
              <DropdownMenuItem onSelect={() => startRename(snapshot)}>
                {i18n.t('history.nameVersion')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  return (
    <aside className="w-72 shrink-0 border-l border-border pl-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 h-10">
        <button
          type="button"
          onClick={onClose}
          aria-label={i18n.t('common.close')}
          className="p-1 text-muted-foreground hover:text-foreground"
        >
          <X size={14} />
        </button>
        <span className="text-[13px] font-semibold text-foreground">{i18n.t('history.title')}</span>
      </div>

      {history.error && (
        <p role="alert" className="text-[11px] text-destructive py-2">
          {history.error}
        </p>
      )}

      {history.loading ? (
        <p className="text-[11px] text-muted-foreground py-2">{i18n.t('common.loading')}</p>
      ) : snapshots.length === 0 ? (
        <p className="text-[11px] text-muted-foreground py-2">{i18n.t('history.empty')}</p>
      ) : (
        <>
          <div className="flex items-center gap-1 pb-1">
            <button
              type="button"
              aria-pressed={!namedOnly}
              onClick={() => setNamedOnly(false)}
              className={filterPill(!namedOnly)}
            >
              {i18n.t('history.allVersions')}
            </button>
            <button
              type="button"
              aria-pressed={namedOnly}
              onClick={() => setNamedOnly(true)}
              className={filterPill(namedOnly)}
            >
              {i18n.t('history.namedOnly')}
            </button>
          </div>
          <div className="relative border-l border-dashed border-border ml-1 pl-2 flex-1 min-h-0 overflow-y-auto">
            <div className="pl-5 py-2.5 relative">
              <span
                className={`absolute left-0 top-4 w-2 h-2 rounded-full border-2 ${
                  selectedId === null ? 'bg-accent border-accent' : 'bg-card border-border'
                }`}
              />
              <button
                type="button"
                aria-pressed={selectedId === null}
                onClick={() => onSelect(null)}
                className={`block w-full text-left text-[12px] ${
                  selectedId === null ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {i18n.t('history.current')}
              </button>
              {currentSummary && <p className="text-[11px] text-muted-foreground mt-0.5">{currentSummary}</p>}
            </div>
            {namedOnly ? (
              named.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-2 pl-5">{i18n.t('history.emptyNamed')}</p>
              ) : (
                named.map(entry)
              )
            ) : (
              groupSnapshots(snapshots).map((row) =>
                row.kind === 'entry' ? (
                  entry(row.snapshot)
                ) : (
                  <div key={row.snapshots[0].id}>
                    <button
                      type="button"
                      aria-expanded={expanded.has(row.snapshots[0].id)}
                      onClick={() => toggle(row.snapshots[0].id)}
                      className="flex items-center gap-1 py-2 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <ChevronRight
                        size={11}
                        className={
                          expanded.has(row.snapshots[0].id) ? 'rotate-90 transition-transform' : 'transition-transform'
                        }
                      />
                      {i18n.t('history.unchangedVersions', [String(row.snapshots.length)])}
                    </button>
                    {expanded.has(row.snapshots[0].id) && row.snapshots.map(entry)}
                  </div>
                ),
              )
            )}
          </div>
        </>
      )}
    </aside>
  );
}
