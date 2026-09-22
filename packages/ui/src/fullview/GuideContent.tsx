import { i18n, localStorage } from '@mimik/core/env';
import { isReplayable } from '@mimik/core/guideme/session';
import { actionSteps } from '@mimik/core/guides/blocks';
import { getMostCommonDomain } from '@mimik/core/guides/domain';
import {
  deleteStep,
  getGuide,
  getScreenshotsForSteps,
  onGuidesChanged,
  updateGuideDescription,
  updateGuideTitle,
  updateStepDescription,
} from '@mimik/core/guides/service';
import type { SnapshotLike } from '@mimik/core/guides/snapshot-diff';
import type { Guide, Screenshot, Snapshot, Step } from '@mimik/core/guides/types';
import type { ScreenshotEdits } from '@mimik/core/screenshot/types';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mimik/ui/components/ui/tooltip';
import { panel, send, tabs } from '@mimik/ui/env';
import { logger } from '@mimik/ui/lib/logger';
import { formatDate } from '@mimik/ui/lib/utils';
import AnnotationEditor from '@mimik/ui/shared/AnnotationEditor';
import { useAskAi } from '@mimik/ui/shared/AskAi';
import FaviconImg from '@mimik/ui/shared/FaviconImg';
import Toast from '@mimik/ui/shared/Toast';
import { useFullview } from '@mimik/ui/stores/fullview';
import { History, Loader2, Play, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TypeAnimation } from 'react-type-animation';
import GuideStepList from './components/GuideStepList';
import VersionHistoryPanel from './components/VersionHistoryPanel';
import { useGuideDescription } from './use-guide-description';

interface GuideContentProps {
  guideId: string;
  initialStepId?: string;
  initialTool?: 'annotate' | 'redact' | 'crop' | 'target';
}

interface GuideData {
  guide: Guide;
  steps: Step[];
  screenshots: Map<string, Screenshot>;
}

interface PreviewData {
  snapshotId: string;
  steps: Step[];
  screenshots: Map<string, Screenshot>;
}

async function buildPreview(snapshot: Snapshot): Promise<PreviewData> {
  const rows = new Map(snapshot.screenshots.map((row) => [row.id, row]));
  const steps = [...snapshot.steps].sort((a, b) => a.index - b.index);
  const wanted = steps.map((s) => s.screenshotId).filter((id): id is string => !!id && rows.has(id));
  const live = await getScreenshotsForSteps(wanted);
  const blobs = new Map([...live.values()].map((row) => [row.id, row.blob]));
  const screenshots = new Map<string, Screenshot>();
  for (const step of steps) {
    const row = step.screenshotId ? rows.get(step.screenshotId) : undefined;
    const blob = row ? blobs.get(row.id) : undefined;
    if (row && blob) screenshots.set(step.id, { ...row, blob });
  }
  return { snapshotId: snapshot.id, steps, screenshots };
}

export default function GuideContent({ guideId, initialStepId, initialTool }: GuideContentProps) {
  const {
    setGuideTitle,
    setGuideStepCount,
    setGuideExportData,
    scrollToStep,
    editing,
    setEditing,
    historyOpen,
    setHistoryOpen,
    historyRefreshKey,
  } = useFullview((s) => ({
    setGuideTitle: s.setGuideTitle,
    setGuideStepCount: s.setGuideStepCount,
    setGuideExportData: s.setGuideExportData,
    scrollToStep: s.scrollToStep,
    editing: s.editing,
    setEditing: s.setEditing,
    historyOpen: s.historyOpen,
    setHistoryOpen: s.setHistoryOpen,
    historyRefreshKey: s.historyRefreshKey,
  }));

  const [data, setData] = useState<GuideData | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [typingTitle, setTypingTitle] = useState<string | null>(null);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editingTool, setEditingTool] = useState<'annotate' | 'redact' | 'crop' | 'target'>('annotate');
  const [preview, setPreview] = useState<Snapshot | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const applyDescription = useCallback((next: string) => {
    setData((prev) => (prev ? { ...prev, guide: { ...prev.guide, description: next } } : prev));
  }, []);
  const desc = useGuideDescription(guideId, applyDescription);
  const titleRef = useRef('');
  const appliedInitialRef = useRef(false);
  const editingDescriptionRef = useRef(false);

  const loadGuide = useCallback(async () => {
    const result = await getGuide(guideId);
    if (result) {
      setData(result);
      if (!editingDescriptionRef.current) desc.set(result.guide.description ?? '');
      const newTitle = result.guide.title;
      const prev = titleRef.current;
      if (
        prev === i18n.t('fullview_untitledGuide') &&
        newTitle !== i18n.t('fullview_untitledGuide') &&
        result.steps.length > 0
      ) {
        setTypingTitle(newTitle);
      } else {
        titleRef.current = newTitle;
        setTitle(newTitle);
      }
      document.title = `${newTitle} — ${i18n.t('app_name')}`;
      setGuideTitle(newTitle);
      setGuideStepCount(actionSteps(result.steps).length);
    }
    setLoading(false);
  }, [guideId, setGuideTitle, setGuideStepCount]);

  useEffect(() => {
    loadGuide();
    return onGuidesChanged(() => loadGuide());
  }, [loadGuide]);

  useEffect(() => {
    if (data) setGuideExportData({ guideId, ...data });
  }, [data, guideId, setGuideExportData]);

  useEffect(() => {
    localStorage.get(['aiApiKey']).then((s) => desc.setHasApiKey(Boolean(s.aiApiKey)));
  }, []);

  const handleTitleBlur = useCallback(async () => {
    if (!data || title === data.guide.title) return;
    await updateGuideTitle(guideId, title);
    setData((prev) => (prev ? { ...prev, guide: { ...prev.guide, title } } : prev));
    document.title = `${title} — ${i18n.t('app_name')}`;
  }, [data, guideId, title]);

  const handleGuideDescriptionBlur = useCallback(async () => {
    if (data && desc.text !== (data.guide.description ?? '')) {
      await updateGuideDescription(guideId, desc.text);
      setData((prev) => (prev ? { ...prev, guide: { ...prev.guide, description: desc.text } } : prev));
    }
    editingDescriptionRef.current = false;
  }, [data, guideId, desc.text]);

  const askAi = useAskAi(desc.text, desc.commit, desc.hasApiKey);

  const handleDescriptionChange = useCallback(async (stepId: string, description: string) => {
    await updateStepDescription(stepId, description, 'manual');
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, steps: prev.steps.map((s) => (s.id === stepId ? { ...s, description } : s)) };
    });
  }, []);

  const handleDeleteStep = useCallback(
    async (stepId: string) => {
      await deleteStep(guideId, stepId);
      await loadGuide();
    },
    [guideId, loadGuide],
  );

  const handleOpenEditor = useCallback(
    async (stepId: string, tool: 'annotate' | 'redact' | 'crop' | 'target') => {
      await loadGuide();
      setEditingStepId(stepId);
      setEditingTool(tool);
    },
    [loadGuide],
  );

  const handleEditorDone = useCallback(
    (edits: ScreenshotEdits) => {
      if (!editingStepId || !data) return;
      const screenshot = data.screenshots.get(editingStepId);
      if (!screenshot) return;
      setData((prev) => {
        if (!prev) return prev;
        const newScreenshots = new Map(prev.screenshots);
        newScreenshots.set(editingStepId, { ...screenshot, edits });
        return { ...prev, screenshots: newScreenshots };
      });
      setEditingStepId(null);
    },
    [editingStepId, data],
  );

  useEffect(() => {
    if (!preview) {
      setPreviewData(null);
      return;
    }
    let cancelled = false;
    buildPreview(preview)
      .then((built) => {
        if (!cancelled) setPreviewData(built);
      })
      .catch((err) => logger.error(' Version preview failed', err));
    return () => {
      cancelled = true;
    };
  }, [preview]);

  useEffect(() => {
    if (editing || !historyOpen) setPreview(null);
  }, [editing, historyOpen]);

  useEffect(() => {
    if (appliedInitialRef.current || !data || !initialStepId) return;
    if (!data.screenshots.has(initialStepId)) return;
    appliedInitialRef.current = true;
    scrollToStep(initialStepId);
    if (initialTool) {
      setEditingStepId(initialStepId);
      setEditingTool(initialTool);
    }
  }, [data, initialStepId, initialTool, scrollToStep]);

  const live = useMemo<SnapshotLike>(
    () => ({
      title: data?.guide.title ?? '',
      stepIds: data?.guide.stepIds ?? [],
      steps: data?.steps ?? [],
      screenshots: data ? [...data.screenshots.values()] : [],
    }),
    [data],
  );

  if (loading)
    return (
      <div>
        <div className="h-10 w-2/3 rounded-lg bg-border/50 animate-pulse" />
        <div className="h-4 w-48 rounded bg-border/30 animate-pulse mt-3 mb-8" />
        <div className="space-y-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-border/50 p-4">
              <div
                className="aspect-video rounded-lg bg-[#f2f4fa] animate-pulse mb-3"
                style={{ animationDelay: `${i * 150}ms` }}
              />
              <div
                className="h-4 w-3/4 rounded bg-border/40 animate-pulse"
                style={{ animationDelay: `${i * 150 + 50}ms` }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  if (!data) return <p className="text-sm py-12 text-center text-purple">{i18n.t('fullview_guideNotFound')}</p>;

  const previewView = preview && previewData?.snapshotId === preview.id ? previewData : null;
  const viewSteps = previewView ? previewView.steps : data.steps;
  const viewScreenshots = previewView ? previewView.screenshots : data.screenshots;
  const actionCount = actionSteps(viewSteps).length;
  const domain = getMostCommonDomain(viewSteps);
  const editingScreenshot = editingStepId ? data.screenshots.get(editingStepId) : undefined;
  const animatingTitle = preview ? null : typingTitle;
  const untitledPending =
    !preview && !typingTitle && title === i18n.t('fullview_untitledGuide') && viewSteps.length > 0;
  const metaGenerating = (untitledPending || animatingTitle !== null) && !desc.text;

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)]">
      {editingStepId && editingScreenshot && (
        <AnnotationEditor
          screenshot={editingScreenshot}
          tool={editingTool}
          onDone={handleEditorDone}
          onCancel={() => setEditingStepId(null)}
        />
      )}

      <div className={historyOpen ? 'flex items-start gap-6' : ''}>
        <div className={historyOpen ? 'flex-1 min-w-0' : ''}>
          {preview && (
            <div className="flex items-center gap-2 rounded-lg bg-secondary border border-border px-4 py-3 mb-4">
              <History size={15} className="text-accent shrink-0" />
              <span className="text-[12px] text-foreground">{i18n.t('history.readOnlyBanner')}</span>
            </div>
          )}

          <div className={untitledPending ? 'min-h-[88px]' : ''}>
            {untitledPending ? (
              <div className="text-[32px] font-extrabold leading-tight animate-gradient-text bg-[length:300%_100%] bg-clip-text text-transparent bg-gradient-to-r from-muted-foreground via-violet to-muted-foreground max-w-[480px]">
                {i18n.t('fullview_writingTitle')}
              </div>
            ) : animatingTitle ? (
              <div className="relative text-[32px] font-extrabold leading-tight">
                <div className="invisible" aria-hidden="true">
                  {animatingTitle}
                </div>
                <div className="absolute inset-0 text-foreground">
                  <TypeAnimation
                    sequence={[
                      animatingTitle,
                      () => {
                        titleRef.current = animatingTitle;
                        setTitle(animatingTitle);
                        setTypingTitle(null);
                      },
                    ]}
                    speed={70}
                    cursor={false}
                  />
                  <span className="inline-block w-[3px] h-[30px] bg-violet ml-0.5 align-text-bottom animate-blink" />
                </div>
              </div>
            ) : editing && !preview ? (
              <textarea
                ref={(el) => {
                  if (el) {
                    el.style.height = '0';
                    el.style.height = `${el.scrollHeight}px`;
                  }
                }}
                value={title}
                rows={1}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setGuideTitle(e.target.value);
                  const el = e.target;
                  el.style.height = '0';
                  el.style.height = `${el.scrollHeight}px`;
                }}
                onBlur={handleTitleBlur}
                className="text-[32px] font-extrabold bg-transparent border-b-2 border-transparent hover:border-border focus:outline-none focus:border-accent w-full p-0 text-foreground resize-none leading-tight overflow-hidden"
              />
            ) : (
              <h1 className="text-[32px] font-extrabold leading-tight text-foreground whitespace-pre-wrap break-words">
                {preview ? preview.title : title}
              </h1>
            )}
          </div>

          {!preview && (
            <div className="mt-3">
              {metaGenerating ? (
                <div className="max-w-[720px] text-[15px] leading-relaxed animate-gradient-text bg-[length:300%_100%] bg-clip-text text-transparent bg-gradient-to-r from-muted-foreground via-violet to-muted-foreground">
                  {i18n.t('fullview_writingDescription')}
                </div>
              ) : editing ? (
                <div className="flex items-start gap-2 max-w-[720px]">
                  <textarea
                    ref={(el) => {
                      if (el) {
                        el.style.height = '0';
                        el.style.height = `${el.scrollHeight}px`;
                      }
                    }}
                    value={desc.text}
                    rows={2}
                    onChange={(e) => {
                      desc.set(e.target.value);
                      const el = e.target;
                      el.style.height = '0';
                      el.style.height = `${el.scrollHeight}px`;
                    }}
                    onFocus={() => {
                      editingDescriptionRef.current = true;
                    }}
                    onSelect={askAi.onSelect}
                    onBlur={handleGuideDescriptionBlur}
                    placeholder={i18n.t('editor.descriptionPlaceholder')}
                    className="flex-1 resize-none overflow-hidden bg-transparent p-0 text-[15px] leading-relaxed text-muted-foreground placeholder:text-muted-foreground/60 border-b-2 border-transparent hover:border-border focus:outline-none focus:border-accent"
                  />
                  {desc.hasApiKey && <span className="shrink-0 mt-0.5">{askAi.trigger}</span>}
                  {desc.hasApiKey &&
                    (() => {
                      const busy = desc.generating || metaGenerating;
                      const label = desc.text
                        ? i18n.t('editor.regenerateDescription')
                        : i18n.t('editor.generateDescription');
                      return (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => {
                                if (busy) return;
                                void desc.generate();
                              }}
                              aria-disabled={busy}
                              aria-label={label}
                              className="shrink-0 mt-0.5 p-1 rounded-md text-muted-foreground hover:text-accent hover:bg-secondary transition-colors aria-disabled:cursor-not-allowed aria-disabled:hover:text-muted-foreground aria-disabled:hover:bg-transparent"
                            >
                              {busy ? (
                                <Loader2 size={15} className="animate-spin text-accent" />
                              ) : (
                                <Sparkles size={15} />
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{label}</TooltipContent>
                        </Tooltip>
                      );
                    })()}
                  <Toast message={desc.error} onDismiss={desc.clearError} />
                </div>
              ) : (
                desc.text && (
                  <p className="max-w-[720px] text-[15px] leading-relaxed text-muted-foreground">{desc.text}</p>
                )
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 mt-2 mb-4 flex-wrap">
            <span className="inline-flex items-center text-[11px] font-medium text-muted-foreground bg-card border border-border px-2.5 py-0.5 rounded-full">
              {formatDate(data.guide.createdAt)}
            </span>
            <span className="inline-flex items-center text-[11px] font-medium text-muted-foreground bg-card border border-border px-2.5 py-0.5 rounded-full">
              {actionCount !== 1
                ? i18n.t('fullview_stepCountPlural', [String(actionCount)])
                : i18n.t('fullview_stepCount', [String(actionCount)])}
            </span>
            {domain && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-card border border-border pl-1.5 pr-2.5 py-0.5 rounded-full">
                <FaviconImg domain={domain} size={14} className="rounded-full" />
                {domain}
              </span>
            )}
            {!editing && !preview && viewSteps.some(isReplayable) && (
              <button
                onClick={() => {
                  panel.open();
                  void send('startGuideMe', { guideId });
                }}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary-foreground bg-primary hover:bg-primary/90 px-3 py-0.5 rounded-full transition-colors ml-auto"
              >
                <Play size={11} />
                {i18n.t('fullview_guideMe')}
              </button>
            )}
          </div>

          <GuideStepList
            guideId={guideId}
            steps={viewSteps}
            screenshots={viewScreenshots}
            onDescriptionChange={handleDescriptionChange}
            onDelete={handleDeleteStep}
            onOpenEditor={handleOpenEditor}
            onReorder={(newSteps) => setData((prev) => (prev ? { ...prev, steps: newSteps } : prev))}
            readOnly={!editing || preview !== null}
            hasApiKey={desc.hasApiKey}
            onChanged={loadGuide}
            onInsertRecording={(targetGuideId, insertAtIndex, tabId) => {
              panel.open();
              void tabs.startInsertRecording(targetGuideId, insertAtIndex, tabId);
            }}
          />
        </div>

        {historyOpen && (
          <VersionHistoryPanel
            guideId={guideId}
            selectedId={preview?.id ?? null}
            refreshKey={historyRefreshKey}
            live={live}
            onSelect={(snapshot) => {
              setPreview(snapshot);
              if (snapshot) setEditing(false);
            }}
            onRestored={loadGuide}
            onClose={() => setHistoryOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
