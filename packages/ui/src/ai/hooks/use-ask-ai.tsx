import { REWRITE_PRESETS, type RewritePreset } from '@mimik/core/capture/ai/prompts';
import { i18n } from '@mimik/core/env';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Toast } from '../../common/components/Toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import { ai } from '../../env';
import { rewriteErrorMessage } from '../lib/rewrite-error';

const PRESET_LABEL_KEYS = {
  shorter: 'editor.rewriteShorter',
  detail: 'editor.rewriteDetail',
  grammar: 'editor.rewriteGrammar',
  formal: 'editor.rewriteFormal',
  casual: 'editor.rewriteCasual',
} as const satisfies Record<RewritePreset, string>;

const PRESET_ORDER = Object.keys(PRESET_LABEL_KEYS) as RewritePreset[];

const PANEL_WIDTH = 320;
const PANEL_GAP = 6;
const VIEWPORT_MARGIN = 8;

interface Span {
  start: number;
  end: number;
  lead: string;
  core: string;
  trail: string;
}

function readSpan(value: string, start: number, end: number): Span | null {
  const raw = value.slice(start, end);
  const core = raw.trim();
  if (!core) return null;
  const lead = raw.slice(0, raw.indexOf(core[0]!));
  return { start, end, lead, core, trail: raw.slice(lead.length + core.length) };
}

export function useAskAi(value: string, onReplace: (next: string) => void, enabled = true) {
  const [span, setSpan] = useState<Span | null>(null);
  const [active, setActive] = useState<Span | null>(null);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setActive(null);
    setInstruction('');
    setResult(null);
  }, []);

  const place = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const maxLeft = window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN;
    setAnchor({
      top: rect.bottom + PANEL_GAP,
      left: Math.min(Math.max(VIEWPORT_MARGIN, rect.left), Math.max(VIEWPORT_MARGIN, maxLeft)),
    });
  }, []);

  useEffect(() => {
    if (!active) return;
    place();
    const reposition = () => place();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [active, place]);

  useEffect(() => {
    if (!active) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      reset();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') reset();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [active, reset]);

  useEffect(() => {
    if (active && result === null) inputRef.current?.focus();
  }, [active, result]);

  const onSelect = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    setSpan(readSpan(el.value, el.selectionStart, el.selectionEnd));
  }, []);

  const open = useCallback(() => {
    if (!value.trim()) return;
    const target = span ?? readSpan(value, 0, value.length);
    if (!target) return;
    setResult(null);
    setInstruction('');
    setActive(target);
  }, [span, value]);

  const run = useCallback(
    async (target: Span, prompt: string) => {
      if (!prompt.trim() || busy) return;
      setBusy(true);
      setError(null);
      try {
        const response = await ai.rewriteSelection(target.core, prompt);
        if (response.error) {
          setError(rewriteErrorMessage(response.error));
          return;
        }
        if (response.text) setResult(response.text);
      } catch {
        setError(rewriteErrorMessage('generation-failed'));
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  const replace = useCallback(() => {
    if (!active || !result) return;
    if (value.slice(active.start, active.end) !== active.lead + active.core + active.trail) {
      setError(i18n.t('editor.rewriteErrorStale'));
      reset();
      return;
    }
    onReplace(value.slice(0, active.start) + active.lead + result + active.trail + value.slice(active.end));
    setSpan(null);
    reset();
  }, [active, result, value, onReplace, reset]);

  const panel =
    active && anchor
      ? createPortal(
          <div
            ref={panelRef}
            style={{ top: anchor.top, left: anchor.left, width: PANEL_WIDTH }}
            className="fixed z-[2147483000] rounded-lg border border-border bg-card shadow-lg overflow-hidden"
          >
            <p className="px-2.5 pt-2 pb-1.5 text-[11px] leading-snug text-muted-foreground border-b border-border">
              <span className="line-clamp-2">{active.core}</span>
            </p>
            {result === null ? (
              <>
                <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border">
                  <Sparkles size={12} className="shrink-0 text-accent" />
                  <input
                    ref={inputRef}
                    value={instruction}
                    disabled={busy}
                    onChange={(e) => setInstruction(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void run(active, instruction);
                      }
                    }}
                    placeholder={i18n.t('editor.rewritePlaceholder')}
                    className="flex-1 min-w-0 bg-transparent p-0 text-[12px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-50"
                  />
                  {busy ? (
                    <Loader2 size={12} className="shrink-0 animate-spin text-accent" />
                  ) : (
                    <span className="shrink-0 text-[10px] text-muted-foreground">{i18n.t('editor.rewriteEnter')}</span>
                  )}
                </div>
                <div className="py-1">
                  {PRESET_ORDER.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      disabled={busy}
                      onClick={() => void run(active, REWRITE_PRESETS[preset])}
                      className="w-full px-2.5 py-1.5 text-left text-[12px] text-foreground hover:bg-secondary disabled:opacity-50"
                    >
                      {i18n.t(PRESET_LABEL_KEYS[preset])}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="px-2.5 py-2 text-[12px] leading-snug text-foreground whitespace-pre-wrap border-b border-border">
                  {result}
                </p>
                <div className="flex items-center gap-1 px-2 py-1.5">
                  <button
                    type="button"
                    onClick={replace}
                    className="rounded-md bg-accent px-2 py-1 text-[11px] font-medium text-primary-foreground hover:bg-deep"
                  >
                    {i18n.t('editor.rewriteReplace')}
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-secondary"
                  >
                    {i18n.t('editor.rewriteDiscard')}
                  </button>
                </div>
              </>
            )}
          </div>,
          document.body,
        )
      : null;

  const trigger = !enabled ? null : (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={triggerRef}
            type="button"
            onClick={open}
            aria-disabled={!value.trim()}
            aria-label={i18n.t('editor.rewriteAskAi')}
            className={`p-1 rounded-md transition-colors aria-disabled:opacity-40 aria-disabled:cursor-not-allowed ${active ? 'text-accent' : 'text-border hover:text-accent'}`}
          >
            <Wand2 size={14} />
          </button>
        </TooltipTrigger>
        <TooltipContent>{i18n.t('editor.rewriteAskAi')}</TooltipContent>
      </Tooltip>
      {panel}
      <Toast message={error} onDismiss={() => setError(null)} />
    </>
  );

  return { onSelect, trigger };
}
