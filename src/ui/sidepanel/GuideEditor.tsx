import {
  BlockCard,
  EmptyGuideState,
  FaviconImg,
  getMostCommonDomain,
  StepCard,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@mimik/ui';
import { ArrowLeft, Maximize2, Play } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { i18n } from '#imports';
import { isReplayable } from '@/core/guideme/session';
import { actionSteps, isBlock, stepNumbers } from '@/core/guides/blocks';
import { getGuide, onGuidesChanged } from '@/core/guides/service';
import type { Guide, Screenshot, Step } from '@/core/guides/types';
import { dominantRatio } from '@/core/screenshot/geometry';
import { createTab, focusWindow, getExtensionURL, queryTabs, updateTab } from '@/lib/browser-api';
import { sendMessage } from '@/lib/messaging';

interface GuideEditorProps {
  guideId: string;
  onBack: () => void;
  onGuideMe?: (guideId: string) => void;
}

interface OpenInFullViewOptions {
  stepId?: string;
  tool?: 'annotate' | 'redact' | 'crop' | 'target';
}

interface GuideData {
  guide: Guide;
  steps: Step[];
  screenshots: Map<string, Screenshot>;
}

export default function GuideEditor({ guideId, onBack, onGuideMe }: GuideEditorProps) {
  const [data, setData] = useState<GuideData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const applyGuide = useCallback((result: GuideData) => {
    setData(result);
  }, []);

  const loadGuide = useCallback(async () => {
    const result = await getGuide(guideId);
    if (!result) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    applyGuide(result);
    setLoading(false);
  }, [guideId, applyGuide]);

  useEffect(() => {
    loadGuide();
  }, [loadGuide]);

  useEffect(() => {
    return onGuidesChanged(loadGuide);
  }, [loadGuide]);

  const openInFullView = useCallback((targetGuideId: string, options?: OpenInFullViewOptions) => {
    const params = new URLSearchParams({ guideId: targetGuideId });
    if (options?.stepId) params.set('stepId', options.stepId);
    if (options?.tool) params.set('tool', options.tool);
    const url = getExtensionURL(`/fullview.html?${params.toString()}`);
    queryTabs({ url: getExtensionURL('/fullview.html') }).then((tabs) => {
      if (tabs.length > 0 && tabs[0].id) {
        updateTab(tabs[0].id, { active: true, url });
        if (tabs[0].windowId) focusWindow(tabs[0].windowId);
      } else {
        createTab({ url });
      }
    });
  }, []);

  if (loading) return <p className="text-sm text-purple p-4">{i18n.t('common.loading')}</p>;

  if (notFound || !data) {
    return (
      <div className="p-4">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-purple hover:text-foreground mb-4">
          <ArrowLeft size={18} />
          {i18n.t('common.back')}
        </button>
        <p className="text-sm text-destructive">{i18n.t('fullview.guideNotFound')}</p>
      </div>
    );
  }

  const actionCount = actionSteps(data.steps).length;
  const numbers = stepNumbers(data.steps);
  const domain = getMostCommonDomain(data.steps);

  return (
    <div className="min-h-screen bg-card flex flex-col">
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={onBack} className="shrink-0 p-1 rounded text-purple hover:text-foreground">
                <ArrowLeft size={18} />
              </button>
            </TooltipTrigger>
            <TooltipContent align="start">{i18n.t('editor.backToLibrary')}</TooltipContent>
          </Tooltip>

          <div className="flex-1 min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <h2 className="text-[13px] font-bold truncate text-foreground leading-tight">{data.guide.title}</h2>
              </TooltipTrigger>
              <TooltipContent align="start">{data.guide.title}</TooltipContent>
            </Tooltip>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground leading-tight">
              <span>
                {actionCount !== 1
                  ? i18n.t('fullview.stepCountPlural', [String(actionCount)])
                  : i18n.t('fullview.stepCount', [String(actionCount)])}
              </span>
              {domain && (
                <>
                  <span className="text-border">·</span>
                  <FaviconImg domain={domain} size={10} className="rounded-full" />
                  <span className="truncate">{domain}</span>
                </>
              )}
            </div>
          </div>

          {data.steps.length > 0 &&
            (() => {
              const replayable = data.steps.some(isReplayable);
              const label = i18n.t(replayable ? 'editor.guideMe' : 'editor.guideMeUnavailable');
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={async () => {
                        if (!replayable) return;
                        await sendMessage('startGuideMe', { guideId });
                        onGuideMe?.(guideId);
                      }}
                      aria-disabled={!replayable}
                      aria-label={label}
                      className="shrink-0 p-1.5 rounded-md transition-colors text-purple hover:text-accent hover:bg-secondary aria-disabled:opacity-30 aria-disabled:cursor-not-allowed aria-disabled:hover:text-purple aria-disabled:hover:bg-transparent"
                    >
                      <Play size={15} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{label}</TooltipContent>
                </Tooltip>
              );
            })()}

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => openInFullView(guideId)}
                className="shrink-0 flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-purple transition-colors hover:border-accent hover:text-accent"
              >
                <Maximize2 size={12} />
                {i18n.t('editor.openInDashboard')}
              </button>
            </TooltipTrigger>
            <TooltipContent align="end">{i18n.t('editor.openInDashboardHint')}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="px-4 pt-1 pb-4 flex-1 flex flex-col">
        {data.steps.length === 0 ? (
          <EmptyGuideState />
        ) : (
          data.steps.map((step) =>
            isBlock(step) ? (
              <BlockCard key={step.id} step={step} readOnly />
            ) : (
              <StepCard
                key={step.id}
                step={step}
                number={numbers.get(step.id) ?? 0}
                screenshot={data.screenshots.get(step.id)}
                placeholderRatio={dominantRatio(data.screenshots)}
                frameRatio={dominantRatio(data.screenshots)}
                readOnly
              />
            ),
          )
        )}
      </div>
    </div>
  );
}
