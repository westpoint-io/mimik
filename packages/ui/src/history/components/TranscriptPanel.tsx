import { i18n } from '@mimik/core/env';
import { downloadText, safeFilename } from '@mimik/core/export/download';
import { stepNumbers } from '@mimik/core/guides/blocks';
import { addTranscriptLineToStep, deleteTranscripts, getTranscripts } from '@mimik/core/guides/service';
import {
  countUnused,
  formatOffset,
  mergeTranscripts,
  nearestStepId,
  type TimelineLine,
  transcriptToText,
  withLiveSteps,
} from '@mimik/core/guides/transcript';
import type { Step } from '@mimik/core/guides/types';
import { logger } from '@mimik/core/logger';
import { Check, Copy, Download, Plus, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmDialog } from '../../common/components/ConfirmDialog';
import { Button } from '../../components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import { useFullview } from '../../stores/use-fullview';
import { transcriptPill } from '../lib/transcript-pill';

interface TranscriptPanelProps {
  guideId: string;
  guideTitle: string;
  steps: Step[];
  readOnly?: boolean;
  refreshKey?: number;
  onClose: () => void;
  onChanged?: () => void;
}

export function TranscriptPanel({
  guideId,
  guideTitle,
  steps,
  readOnly,
  refreshKey,
  onClose,
  onChanged,
}: TranscriptPanelProps) {
  const scrollToStep = useFullview((s) => s.scrollToStep);
  const [lines, setLines] = useState<TimelineLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unusedOnly, setUnusedOnly] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const refreshRef = useRef(refreshKey);

  const load = useCallback(async () => {
    try {
      setLines(mergeTranscripts(await getTranscripts(guideId)));
    } catch (err) {
      logger.error(' Transcript could not be read', err);
      setError(i18n.t('transcript.loadError'));
    } finally {
      setLoading(false);
    }
  }, [guideId]);

  useEffect(() => {
    const silent = refreshRef.current === refreshKey;
    refreshRef.current = refreshKey;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    void load();
  }, [load, refreshKey]);

  const numbers = useMemo(() => stepNumbers(steps), [steps]);

  const timeline = useMemo(() => withLiveSteps(lines, steps), [lines, steps]);

  const unused = countUnused(timeline);
  const shown = timeline.map((line, index) => ({ line, index })).filter(({ line }) => !unusedOnly || !line.stepId);

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(transcriptToText(timeline, numbers));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      logger.error(' Transcript could not be copied', err);
    }
  };

  const handleDownload = () => {
    downloadText(transcriptToText(timeline, numbers), safeFilename(`${guideTitle} transcript`, 'txt'), 'text/plain');
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    await deleteTranscripts(guideId);
    setLines([]);
    onChanged?.();
  };

  const targetFor = (line: TimelineLine, index: number): string | null => line.stepId ?? nearestStepId(timeline, index);

  const handleAddToStep = async (line: TimelineLine, index: number) => {
    const targetId = targetFor(line, index);
    if (!targetId) return;
    if (!(await addTranscriptLineToStep(line.rowId, line.lineIndex, targetId, line.text))) return;
    await load();
    onChanged?.();
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
        <span className="text-[13px] font-semibold text-foreground">{i18n.t('transcript.title')}</span>
      </div>

      {error && (
        <p role="alert" className="text-[11px] text-destructive py-2">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-[11px] text-muted-foreground py-2">{i18n.t('common.loading')}</p>
      ) : lines.length === 0 ? (
        <p className="text-[11px] text-muted-foreground py-2">{i18n.t('transcript.empty')}</p>
      ) : (
        <>
          <div className="flex items-center gap-1 pb-1">
            <button
              type="button"
              aria-pressed={!unusedOnly}
              className={transcriptPill(!unusedOnly)}
              onClick={() => setUnusedOnly(false)}
            >
              {i18n.t('transcript.filterAll', [String(lines.length)])}
            </button>
            <button
              type="button"
              aria-pressed={unusedOnly}
              className={transcriptPill(unusedOnly)}
              onClick={() => setUnusedOnly(true)}
            >
              {i18n.t('transcript.filterUnused', [String(unused)])}
            </button>
          </div>

          <p className="text-[10px] leading-snug text-muted-foreground pb-1">{i18n.t('transcript.privacyNote')}</p>

          {readOnly && unused > 0 && (
            <p className="text-[10px] leading-snug text-accent pb-1">{i18n.t('transcript.readOnlyHint')}</p>
          )}

          <ul className="flex flex-col gap-2 overflow-y-auto pr-1">
            {shown.map(({ line, index }) => {
              const number = line.stepId ? numbers.get(line.stepId) : undefined;
              const targetId = targetFor(line, index);
              const suggestion = targetId ? numbers.get(targetId) : undefined;
              return (
                <li key={`${line.atMs}-${index}`} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                      {formatOffset(line.offsetSeconds)}
                    </span>
                    {number ? (
                      <button
                        type="button"
                        onClick={() => line.stepId && scrollToStep(line.stepId)}
                        className="text-[9px] font-bold uppercase tracking-wide rounded px-1 py-[2px] bg-success/10 text-success"
                      >
                        {i18n.t('transcript.usedInStep', [String(number)])}
                      </button>
                    ) : (
                      <span className="text-[9px] font-bold uppercase tracking-wide rounded px-1 py-[2px] border border-border text-muted-foreground">
                        {line.rejectReason ? i18n.t('transcript.filteredOut') : i18n.t('transcript.notUsed')}
                      </span>
                    )}
                    {!readOnly && !number && suggestion && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => void handleAddToStep(line, index)}
                            aria-label={i18n.t('transcript.addToStep', [String(suggestion)])}
                            className="ml-auto p-0.5 rounded text-muted-foreground hover:text-accent"
                          >
                            <Plus size={12} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{i18n.t('transcript.addToStep', [String(suggestion)])}</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <p className="text-[11px] leading-snug text-foreground">{line.text}</p>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center gap-1 pt-2 mt-auto">
            <Button size="sm" variant="ghost" onClick={() => void handleCopyAll()} className="h-7 px-2 text-[11px]">
              {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
              {i18n.t('transcript.copyAll')}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDownload} className="h-7 px-2 text-[11px]">
              <Download size={12} />
              {i18n.t('transcript.download')}
            </Button>
            {!readOnly && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    aria-label={i18n.t('transcript.delete')}
                    className="ml-auto p-1 rounded-md text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={13} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{i18n.t('transcript.delete')}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDelete}
        heading={i18n.t('transcript.confirmDelete')}
        destructive
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </aside>
  );
}
