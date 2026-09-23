import { i18n, localStorage } from '@mimik/core/env';
import { updateScreenshotEdits } from '@mimik/core/guides/service';
import type { Screenshot, ScreenshotBounds } from '@mimik/core/guides/types';
import { shadeOf } from '@mimik/core/screenshot/color';
import { drawAnnotation, drawRoundedRect, TARGET_RADIUS, TARGET_STROKE } from '@mimik/core/screenshot/draw';
import {
  annotationBounds,
  cropTo,
  type Handle,
  hitTest,
  moveAnnotation,
  resizeAnnotation,
  resolveTarget,
} from '@mimik/core/screenshot/geometry';
import type {
  Annotation,
  ArrowEnd,
  FontFamily,
  LineWidth,
  ScreenshotEdits,
  TargetBorder,
} from '@mimik/core/screenshot/types';
import {
  ARROW_ENDS,
  DEFAULT_LINE_HEIGHT,
  DEFAULT_TARGET_COLOR,
  FONT_FAMILIES,
  FONT_FAMILY_ORDER,
  LINE_WIDTH_ORDER,
  LINE_WIDTHS,
  MAX_FONT_SIZE,
  MAX_LINE_HEIGHT,
  MIN_FONT_SIZE,
  MIN_LINE_HEIGHT,
} from '@mimik/core/screenshot/types';
import { useEditHistory } from '@mimik/ui/annotation/hooks/use-edit-history';
import { usePointerGesture } from '@mimik/ui/annotation/hooks/use-pointer-gesture';
import { useTextStyle } from '@mimik/ui/annotation/hooks/use-text-style';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@mimik/ui/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@mimik/ui/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mimik/ui/components/ui/tooltip';
import {
  ArrowUpRight,
  ChevronDown,
  Circle as CircleIcon,
  CopyPlus,
  Crop,
  EyeOff,
  Minus,
  MousePointer2,
  MousePointerClick,
  MoveVertical,
  Redo2,
  RotateCcw,
  Square,
  SquareDashed,
  Trash2,
  Type,
  Undo2,
} from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ColorPicker, { swatchStyle } from './ColorPicker';

type EditorMode = 'crop' | 'annotate' | 'redact';
type EditorTool = 'select' | 'crop' | 'box' | 'ellipse' | 'arrow' | 'line' | 'text' | 'redact';

interface AnnotationEditorProps {
  screenshot: Screenshot;
  tool: 'annotate' | 'redact' | 'crop' | 'target';
  onDone: (edits: ScreenshotEdits) => void;
  onCancel: () => void;
}

interface TextEditorState {
  x: number;
  y: number;
  left: number;
  top: number;
}

type DragState =
  | { mode: 'move'; id: string; lastX: number; lastY: number }
  | { mode: 'resize'; id: string; handle: Handle; lastX: number; lastY: number }
  | { mode: 'crop'; start: { x: number; y: number }; rect: ScreenshotBounds }
  | { mode: 'cropResize'; handle: Handle; rect: ScreenshotBounds; lastX: number; lastY: number }
  | { mode: 'cropMove'; rect: ScreenshotBounds; lastX: number; lastY: number }
  | { mode: 'draw'; start: { x: number; y: number }; shape: Annotation };

const COLORS = ['#4F46E5', '#DC2626', '#059669', '#F59E0B', '#1E1B4B'];
const SELECTION_COLOR = '#4F46E5';
const BRACKET_ARM = 26;
const BRACKET_THICKNESS = 4;
const MIN_SHAPE_SIZE = 6;
const MIN_CROP_SIZE = 20;
const HANDLE_DISPLAY_SIZE = 10;
const HANDLE_HIT_PX = 10;

function clampNumber(raw: string | number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  width: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  onChange: (value: number) => void;
}

function Stepper({ label, value, min, max, step, decimals = 0, width, prefix, suffix, onChange }: StepperProps) {
  const round = (n: number) => Number(n.toFixed(decimals));
  return (
    <Tip label={label}>
      <div className="flex items-center gap-0.5 rounded-md bg-primary-foreground/10 h-6 px-1">
        {prefix}
        <button
          type="button"
          aria-label="-"
          onClick={() => onChange(round(clampNumber(value - step, min, max)))}
          className="w-4 h-5 rounded text-primary-foreground/70 hover:bg-primary-foreground/15 text-[13px] leading-none"
        >
          &minus;
        </button>
        <input
          value={value}
          inputMode="decimal"
          aria-label={label}
          onChange={(e) => onChange(round(clampNumber(e.target.value, min, max)))}
          className={`${width} bg-transparent text-center text-[11px] tabular-nums text-primary-foreground outline-none`}
        />
        <button
          type="button"
          aria-label="+"
          onClick={() => onChange(round(clampNumber(value + step, min, max)))}
          className="w-4 h-5 rounded text-primary-foreground/70 hover:bg-primary-foreground/15 text-[13px] leading-none"
        >
          +
        </button>
        {suffix}
      </div>
    </Tip>
  );
}

const TOOLBAR_TRIGGER =
  'flex items-center gap-1 h-6 rounded-md bg-primary-foreground/10 px-1.5 text-primary-foreground hover:bg-primary-foreground/20';

function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

interface ColorPopoverProps {
  label: string;
  value: string;
  allowNone?: boolean;
  onChange: (color: string) => void;
  children: ReactNode;
}

function ColorPopover({ label, value, allowNone, onChange, children }: ColorPopoverProps) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>{children}</PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <PopoverContent align="center" className="w-56 p-2.5">
        <ColorPicker value={value} allowNone={allowNone} onChange={onChange} />
      </PopoverContent>
    </Popover>
  );
}

function MenuPopover({ label, children, items }: { label: string; children: ReactNode; items: ReactNode }) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="center">{items}</DropdownMenuContent>
    </DropdownMenu>
  );
}

const ARROW_END_MARKS: Record<ArrowEnd, ReactNode> = {
  none: null,
  bar: <line x1="25" y1="2" x2="25" y2="10" />,
  arrow: <polyline points="19,2 25,6 19,10" fill="none" />,
  'arrow-solid': <polygon points="26,6 18,2 18,10" stroke="none" />,
  circle: <circle cx="22" cy="6" r="3.5" fill="none" />,
  'circle-solid': <circle cx="22" cy="6" r="3.5" stroke="none" />,
  square: <rect x="18.5" y="2.5" width="7" height="7" fill="none" />,
  'square-solid': <rect x="18.5" y="2.5" width="7" height="7" stroke="none" />,
};

function ArrowEndGlyph({ end }: { end: ArrowEnd }) {
  return (
    <svg
      width="30"
      height="12"
      viewBox="0 0 30 12"
      stroke="currentColor"
      strokeWidth="1.6"
      fill="currentColor"
      aria-hidden="true"
    >
      <line x1="3" y1="6" x2={end === 'none' ? 27 : 19} y2="6" />
      {ARROW_END_MARKS[end]}
    </svg>
  );
}

const TARGET_DASH = [8, 5];
const TARGET_MARCH = [26, 10];
const DASH_PERIOD = 13;
const MARCH_PERIOD = 36;
const TARGET_MARCH_CYCLES = 4;
const PULSE_PERIOD_MS = 5200;

const TARGET_SWEEP: [number, number, number][] = [
  [0, 0.35, 0.9],
  [0.2, 1, 0.75],
  [0.4, 0.45, 1],
  [0.6, 1, 0.6],
  [0.8, 0.4, 1],
  [1, 0.35, 0.9],
];

const SELECTION_GAP = 6;
const DRAFT_ID = 'draft';
const TARGET_ID = 'click-target';

const TOOLS: { id: EditorTool; icon: ComponentType<{ size?: number }>; labelKey: string }[] = [
  { id: 'select', icon: MousePointer2, labelKey: 'annotationEditor.toolSelect' },
  { id: 'crop', icon: Crop, labelKey: 'annotationEditor.toolCrop' },
  { id: 'box', icon: Square, labelKey: 'annotationEditor.toolBox' },
  { id: 'ellipse', icon: CircleIcon, labelKey: 'annotationEditor.toolEllipse' },
  { id: 'arrow', icon: ArrowUpRight, labelKey: 'annotationEditor.toolArrow' },
  { id: 'line', icon: Minus, labelKey: 'annotationEditor.toolLine' },
  { id: 'text', icon: Type, labelKey: 'annotationEditor.toolText' },
  { id: 'redact', icon: EyeOff, labelKey: 'annotationEditor.toolRedact' },
];

function modeForTool(tool: EditorTool): EditorMode {
  if (tool === 'crop') return 'crop';
  if (tool === 'redact') return 'redact';
  return 'annotate';
}

function cursorFor(mode: EditorMode, tool: EditorTool, hovering: boolean, grabbing: boolean): string {
  if (grabbing) return 'grabbing';
  if (mode !== 'annotate') return 'crosshair';
  if (hovering) return 'grab';
  if (tool === 'select') return 'default';
  if (tool === 'text') return 'text';
  return 'crosshair';
}

function handleCorners(b: ScreenshotBounds): [Handle, number, number][] {
  return [
    ['nw', b.x, b.y],
    ['ne', b.x + b.width, b.y],
    ['sw', b.x, b.y + b.height],
    ['se', b.x + b.width, b.y + b.height],
  ];
}

function selectionBounds(a: Annotation, scale: number): ScreenshotBounds {
  const inset = SELECTION_GAP * scale;
  const b = annotationBounds(a);
  return { x: b.x - inset, y: b.y - inset, width: b.width + inset * 2, height: b.height + inset * 2 };
}

function hitHandle(b: ScreenshotBounds, x: number, y: number, radius: number): Handle | null {
  for (const [handle, hx, hy] of handleCorners(b)) {
    if (Math.abs(x - hx) <= radius && Math.abs(y - hy) <= radius) return handle;
  }
  return null;
}

export default function AnnotationEditor({ screenshot, tool, onDone, onCancel }: AnnotationEditorProps) {
  const [activeTool, setActiveTool] = useState<EditorTool>(
    tool === 'crop' ? 'crop' : tool === 'redact' ? 'redact' : 'box',
  );
  const [annotations, setAnnotations] = useState<Annotation[]>(() => {
    const existing = screenshot.edits?.annotations ?? [];
    const t = resolveTarget(screenshot);
    if (!t) return existing;
    return [
      ...existing,
      { id: TARGET_ID, type: 'target', x: t.x, y: t.y, w: t.width, h: t.height, color: t.color, border: t.border },
    ];
  });
  const [viewport, setViewport] = useState<ScreenshotBounds | undefined>(screenshot.edits?.viewport);
  const [selectedId, setSelectedId] = useState<string | null>(tool === 'target' ? TARGET_ID : null);
  const [color, setColor] = useState<string>(COLORS[0]);
  const gesture = usePointerGesture();
  const [textEditor, setTextEditor] = useState<TextEditorState | null>(null);
  const [textValue, setTextValue] = useState('');
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [saving, setSaving] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [defaultTargetColor, setDefaultTargetColor] = useState(DEFAULT_TARGET_COLOR);

  const [fill] = useState('transparent');
  const [lineWidth] = useState<LineWidth>('ms');
  const [radius] = useState(0);
  const [arrowEnd] = useState<ArrowEnd>('arrow-solid');
  const text = useTextStyle();

  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;

  const edits = useEditHistory(annotationsRef);
  const pushHistory = edits.push;

  const undo = () => {
    const previous = edits.undo();
    if (previous) setAnnotations(previous);
  };

  const redo = () => {
    const next = edits.redo();
    if (next) setAnnotations(next);
  };

  const mode = modeForTool(activeTool);
  const selected = annotations.find((a) => a.id === selectedId);
  const selectedTarget = selected?.type === 'target' ? selected : null;
  const hasTarget = annotations.some((a) => a.id === TARGET_ID);

  const addTarget = () => {
    pushHistory();
    const w = Math.min(screenshot.width * 0.25, 260);
    const h = Math.min(screenshot.height * 0.1, 90);
    setAnnotations((prev) => [
      ...prev,
      {
        id: TARGET_ID,
        type: 'target',
        x: (screenshot.width - w) / 2,
        y: (screenshot.height - h) / 2,
        w,
        h,
        color: defaultTargetColor,
        border: 'dashed',
      },
    ]);
    setActiveTool('select');
    setSelectedId(TARGET_ID);
  };

  const patchSelected = (patch: Record<string, unknown>) => {
    if (!selectedId || selectedId === TARGET_ID) return;
    pushHistory();
    setAnnotations((prev) => prev.map((a) => (a.id === selectedId ? ({ ...a, ...patch } as Annotation) : a)));
  };

  const updateTarget = (patch: { color?: string; border?: TargetBorder }) => {
    setAnnotations((prev) => prev.map((a) => (a.id === TARGET_ID && a.type === 'target' ? { ...a, ...patch } : a)));
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const getScale = useCallback((): number => {
    const canvas = canvasRef.current;
    if (!canvas) return 1;
    const rect = canvas.getBoundingClientRect();
    return rect.width ? canvas.width / rect.width : 1;
  }, []);

  const toImageSpace = useCallback((e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width ? canvas.width / rect.width : 1;
    const scaleY = rect.height ? canvas.height / rect.height : 1;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loaded: ImageBitmap | null = null;
    setBitmap(null);
    createImageBitmap(screenshot.blob).then((bmp) => {
      if (cancelled) {
        bmp.close();
        return;
      }
      loaded = bmp;
      setBitmap(bmp);
    });
    return () => {
      cancelled = true;
      loaded?.close();
    };
  }, [screenshot.blob]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === 'Escape') {
        setSelectedId(null);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        pushHistory();
        setAnnotations((prev) => prev.filter((a) => a.id !== selectedId));
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, pushHistory]);

  useEffect(() => {
    const sel = annotationsRef.current.find((a) => a.id === selectedId);
    if (!sel) {
      gesture.setAnchor(null);
      return;
    }
    const b = annotationBounds(sel);
    gesture.setAnchor({ x: b.x + b.width / 2, y: b.y + b.height });
  }, [selectedId]);

  useEffect(() => {
    localStorage.get(['targetColor']).then((result) => {
      if (result.targetColor) setDefaultTargetColor(result.targetColor as string);
    });
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const loop = (elapsed: number) => {
      setPulse((elapsed % PULSE_PERIOD_MS) / PULSE_PERIOD_MS);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!textEditor) return;
    const id = requestAnimationFrame(() => textInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [textEditor]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !bitmap) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const a of annotations) {
      if (a.type === 'target') {
        const gradient = ctx.createConicGradient(pulse * Math.PI * 2, a.x + a.w / 2, a.y + a.h / 2);
        for (const [stop, v, s] of TARGET_SWEEP) gradient.addColorStop(stop, shadeOf(a.color, v, s));
        ctx.save();
        ctx.strokeStyle = gradient;
        ctx.lineWidth = TARGET_STROKE + 1;
        ctx.shadowColor = a.color;
        ctx.shadowBlur = 14;
        ctx.setLineDash(a.border === 'dashed' ? TARGET_DASH : TARGET_MARCH);
        ctx.lineDashOffset = -pulse * TARGET_MARCH_CYCLES * (a.border === 'dashed' ? DASH_PERIOD : MARCH_PERIOD);
        drawRoundedRect(ctx, a.x, a.y, a.w, a.h, TARGET_RADIUS);
        ctx.stroke();
        ctx.restore();
        continue;
      }
      drawAnnotation(ctx, a, 0, 0);
    }
    if (gesture.draft) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      drawAnnotation(ctx, gesture.draft, 0, 0);
      ctx.restore();
    }

    const scale = getScale();

    if (mode === 'crop') {
      const frame = gesture.cropDraft ?? viewport ?? { x: 0, y: 0, width: canvas.width, height: canvas.height };
      ctx.save();
      ctx.fillStyle = 'rgba(30, 27, 75, 0.55)';
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, canvas.height);
      ctx.rect(frame.x, frame.y, frame.width, frame.height);
      ctx.fill('evenodd');
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1 * scale;
      ctx.strokeRect(frame.x, frame.y, frame.width, frame.height);

      const arm = Math.min(BRACKET_ARM * scale, frame.width / 3, frame.height / 3);
      const thick = BRACKET_THICKNESS * scale;
      ctx.fillStyle = SELECTION_COLOR;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 4 * scale;
      for (const [handle, hx, hy] of handleCorners(frame)) {
        const left = handle === 'nw' || handle === 'sw';
        const top = handle === 'nw' || handle === 'ne';
        const x = left ? hx : hx - arm;
        const y = top ? hy : hy - arm;
        ctx.fillRect(x, top ? hy : hy - thick, arm, thick);
        ctx.fillRect(left ? hx : hx - thick, y, thick, arm);
      }
      ctx.restore();
    }

    const sel = annotations.find((a) => a.id === selectedId);
    if (sel) {
      const b = selectionBounds(sel, scale);
      ctx.save();
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = 1.5 * scale;
      ctx.strokeRect(b.x, b.y, b.width, b.height);
      const handleSize = HANDLE_DISPLAY_SIZE * scale;
      ctx.fillStyle = SELECTION_COLOR;
      for (const [, hx, hy] of handleCorners(b)) {
        ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
      }
      ctx.restore();
    }
  }, [annotations, gesture.draft, gesture.cropDraft, selectedId, bitmap, getScale, mode, viewport, pulse]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toImageSpace(e);

    if (mode === 'crop') {
      const scale = getScale();
      const frame = viewport ?? { x: 0, y: 0, width: screenshot.width, height: screenshot.height };
      const handle = hitHandle(frame, p.x, p.y, HANDLE_HIT_PX * scale);
      if (handle) {
        dragRef.current = { mode: 'cropResize', handle, rect: frame, lastX: p.x, lastY: p.y };
        gesture.setCropDraft(frame);
        return;
      }
      if (p.x > frame.x && p.x < frame.x + frame.width && p.y > frame.y && p.y < frame.y + frame.height) {
        dragRef.current = { mode: 'cropMove', rect: frame, lastX: p.x, lastY: p.y };
        gesture.setCropDraft(frame);
        return;
      }
      const rect: ScreenshotBounds = { x: p.x, y: p.y, width: 0, height: 0 };
      dragRef.current = { mode: 'crop', start: p, rect };
      gesture.setCropDraft(rect);
      return;
    }

    if (mode === 'redact') {
      const shape: Annotation = { id: DRAFT_ID, type: 'redact', x: p.x, y: p.y, w: 0, h: 0, style: 'blur' };
      dragRef.current = { mode: 'draw', start: p, shape };
      gesture.setDraft(shape);
      return;
    }

    const current = annotations.find((a) => a.id === selectedId);
    if (current) {
      const scale = getScale();
      const handle = hitHandle(selectionBounds(current, scale), p.x, p.y, HANDLE_HIT_PX * scale);
      if (handle) {
        pushHistory();
        dragRef.current = { mode: 'resize', id: current.id, handle, lastX: p.x, lastY: p.y };
        return;
      }
    }

    const hit = hitTest(annotations, p.x, p.y);
    if (hit) {
      pushHistory();
      setSelectedId(hit.id);
      dragRef.current = { mode: 'move', id: hit.id, lastX: p.x, lastY: p.y };
      gesture.setGrabbing(true);
      return;
    }
    setSelectedId(null);

    if (activeTool === 'select') return;

    if (activeTool === 'text') {
      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      setTextEditor({
        x: p.x,
        y: p.y + text.fontSize,
        left: rect ? e.clientX - rect.left : 0,
        top: rect ? e.clientY - rect.top : 0,
      });
      setTextValue('');
      return;
    }

    let shape: Annotation;
    if (activeTool === 'ellipse') {
      shape = { id: DRAFT_ID, type: 'ellipse', x: p.x, y: p.y, w: 0, h: 0, color, fill, lineWidth };
    } else if (activeTool === 'arrow' || activeTool === 'line') {
      shape = {
        id: DRAFT_ID,
        type: 'arrow',
        x1: p.x,
        y1: p.y,
        x2: p.x,
        y2: p.y,
        color,
        lineWidth,
        end: activeTool === 'line' ? 'none' : arrowEnd,
      };
    } else {
      shape = { id: DRAFT_ID, type: 'box', x: p.x, y: p.y, w: 0, h: 0, color, fill, lineWidth, radius };
    }
    dragRef.current = { mode: 'draw', start: p, shape };
    gesture.setDraft(shape);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) {
      if (mode === 'annotate') {
        const p = toImageSpace(e);
        gesture.setHovering(Boolean(hitTest(annotations, p.x, p.y)));
      }
      return;
    }
    const p = toImageSpace(e);

    if (drag.mode === 'move' || drag.mode === 'resize') {
      const dx = p.x - drag.lastX;
      const dy = p.y - drag.lastY;
      drag.lastX = p.x;
      drag.lastY = p.y;
      const next = annotationsRef.current.map((a) => {
        if (a.id !== drag.id) return a;
        return drag.mode === 'move' ? moveAnnotation(a, dx, dy) : resizeAnnotation(a, drag.handle, dx, dy);
      });
      setAnnotations(next);
      const moved = next.find((a) => a.id === drag.id);
      if (moved) {
        const b = annotationBounds(moved);
        gesture.setAnchor({ x: b.x + b.width / 2, y: b.y + b.height });
      }
      return;
    }

    if (drag.mode === 'cropResize') {
      const dx = p.x - drag.lastX;
      const dy = p.y - drag.lastY;
      drag.lastX = p.x;
      drag.lastY = p.y;
      const left = drag.handle === 'nw' || drag.handle === 'sw';
      const top = drag.handle === 'nw' || drag.handle === 'ne';
      const r = drag.rect;
      const next: ScreenshotBounds = {
        x: left ? r.x + dx : r.x,
        y: top ? r.y + dy : r.y,
        width: Math.max(MIN_CROP_SIZE, left ? r.width - dx : r.width + dx),
        height: Math.max(MIN_CROP_SIZE, top ? r.height - dy : r.height + dy),
      };
      drag.rect = cropTo(next, { width: screenshot.width, height: screenshot.height });
      gesture.setCropDraft(drag.rect);
      return;
    }

    if (drag.mode === 'cropMove') {
      const dx = p.x - drag.lastX;
      const dy = p.y - drag.lastY;
      drag.lastX = p.x;
      drag.lastY = p.y;
      drag.rect = cropTo(
        { ...drag.rect, x: drag.rect.x + dx, y: drag.rect.y + dy },
        { width: screenshot.width, height: screenshot.height },
      );
      gesture.setCropDraft(drag.rect);
      return;
    }

    if (drag.mode === 'crop') {
      const rect: ScreenshotBounds = {
        x: Math.min(drag.start.x, p.x),
        y: Math.min(drag.start.y, p.y),
        width: Math.abs(p.x - drag.start.x),
        height: Math.abs(p.y - drag.start.y),
      };
      drag.rect = rect;
      gesture.setCropDraft(rect);
      return;
    }

    const shape = drag.shape;
    let next: Annotation = shape;
    if (shape.type === 'box' || shape.type === 'ellipse' || shape.type === 'redact') {
      next = {
        ...shape,
        x: Math.min(drag.start.x, p.x),
        y: Math.min(drag.start.y, p.y),
        w: Math.abs(p.x - drag.start.x),
        h: Math.abs(p.y - drag.start.y),
      };
    } else if (shape.type === 'arrow') {
      next = { ...shape, x2: p.x, y2: p.y };
    } else if (shape.type === 'freehand') {
      next = { ...shape, points: [...shape.points, p.x, p.y] };
    }
    drag.shape = next;
    gesture.setDraft(next);
  };

  const handlePointerUp = () => {
    gesture.setGrabbing(false);
    const settled = annotations.find((a) => a.id === selectedId);
    if (settled) {
      const b = annotationBounds(settled);
      gesture.setAnchor({ x: b.x + b.width / 2, y: b.y + b.height });
    }
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;

    if (drag.mode === 'crop' || drag.mode === 'cropResize' || drag.mode === 'cropMove') {
      gesture.setCropDraft(null);
      const rect = drag.rect;
      if (rect.width < MIN_CROP_SIZE || rect.height < MIN_CROP_SIZE) return;
      setViewport(cropTo(rect, { width: screenshot.width, height: screenshot.height }));
      return;
    }

    if (drag.mode === 'draw') {
      gesture.setDraft(null);
      const shape = drag.shape;
      if (shape.type === 'freehand') {
        if (shape.points.length < 4) return;
      } else if (shape.type === 'box' || shape.type === 'ellipse' || shape.type === 'redact') {
        if (shape.w < MIN_SHAPE_SIZE || shape.h < MIN_SHAPE_SIZE) return;
      } else if (shape.type === 'arrow') {
        if (Math.hypot(shape.x2 - shape.x1, shape.y2 - shape.y1) < MIN_SHAPE_SIZE) return;
      }
      pushHistory();
      const id = crypto.randomUUID();
      setAnnotations((prev) => [...prev, { ...shape, id }]);
      setActiveTool('select');
      setSelectedId(id);
    }
  };

  const handlePointerCancel = () => {
    dragRef.current = null;
    gesture.clear();
  };

  const setProp = (key: string, value: unknown) => {
    patchSelected({ [key]: value });
  };

  const setTextProp = (patch: {
    fontFamily?: FontFamily;
    bold?: boolean;
    italic?: boolean;
    size?: number;
    lineHeight?: number;
  }) => {
    text.apply({ ...patch, fontSize: patch.size });
    if (!selected || selected.type !== 'text') return;
    const next = {
      fontFamily: patch.fontFamily ?? selected.fontFamily ?? 'sans-serif',
      bold: patch.bold ?? selected.bold ?? false,
      italic: patch.italic ?? selected.italic ?? false,
      size: patch.size ?? selected.size,
      lineHeight: patch.lineHeight ?? selected.lineHeight ?? DEFAULT_LINE_HEIGHT,
    };
    patchSelected({ ...next, ...measureText(selected.text, next.size, next.fontFamily, next.bold, next.italic) });
  };

  const handleColorSelect = (c: string) => {
    setColor(c);
    if (!annotations.some((a) => a.id === selectedId && a.type !== 'redact')) return;
    pushHistory();
    setAnnotations((prev) => prev.map((a) => (a.id === selectedId && a.type !== 'redact' ? { ...a, color: c } : a)));
  };

  const measureText = (value: string, px: number, family: FontFamily, isBold: boolean, isItalic: boolean) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return { w: value.length * px * 0.6, h: px * 1.4 };
    ctx.save();
    ctx.font = `${isItalic ? 'italic ' : ''}${isBold ? 700 : 500} ${px}px ${FONT_FAMILIES[family]}`;
    const w = ctx.measureText(value).width;
    ctx.restore();
    return { w, h: px * 1.4 };
  };

  const commitText = () => {
    if (textEditor && textValue.trim()) {
      const id = crypto.randomUUID();
      pushHistory();
      setActiveTool('select');
      setSelectedId(id);
      setAnnotations((prev) => [
        ...prev,
        {
          id,
          type: 'text',
          x: textEditor.x,
          y: textEditor.y,
          text: textValue.trim(),
          color,
          size: text.fontSize,
          ...measureText(textValue.trim(), text.fontSize, text.fontFamily, text.bold, text.italic),
          fontFamily: text.fontFamily,
          bold: text.bold,
          italic: text.italic,
          lineHeight: text.lineHeight,
        },
      ]);
    }
    setTextEditor(null);
    setTextValue('');
  };

  const handleDone = async () => {
    setSaving(true);
    const targetAnnotation = annotations.find((a) => a.id === TARGET_ID);
    const nextTarget =
      targetAnnotation && targetAnnotation.type === 'target'
        ? {
            x: targetAnnotation.x,
            y: targetAnnotation.y,
            width: targetAnnotation.w,
            height: targetAnnotation.h,
            border: targetAnnotation.border,
            color: targetAnnotation.color,
          }
        : null;
    const nextEdits: ScreenshotEdits = {
      ...screenshot.edits,
      annotations: annotations.filter((a) => a.id !== TARGET_ID),
      target: nextTarget,
    };
    if (viewport && viewport !== screenshot.edits?.viewport) {
      nextEdits.viewport = viewport;
      nextEdits.zoomLevel = undefined;
    } else if (viewport) {
      nextEdits.viewport = viewport;
    }
    await updateScreenshotEdits(screenshot.id, nextEdits);
    onDone(nextEdits);
  };

  return (
    <TooltipProvider>
      <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
        <div className="shrink-0 bg-card border-b border-border px-3 h-[50px] flex items-center gap-3">
          <div className="flex-1 flex items-center gap-1">
            <Tip label={i18n.t('annotationEditor.undo')}>
              <button
                type="button"
                onClick={undo}
                disabled={!edits.canUndo}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-foreground/75 hover:bg-secondary hover:text-foreground disabled:opacity-25"
              >
                <Undo2 size={15} />
              </button>
            </Tip>
            <Tip label={i18n.t('annotationEditor.redo')}>
              <button
                type="button"
                onClick={redo}
                disabled={!edits.canRedo}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-foreground/75 hover:bg-secondary hover:text-foreground disabled:opacity-25"
              >
                <Redo2 size={15} />
              </button>
            </Tip>
          </div>

          <div className="flex items-center gap-0.5 rounded-xl bg-secondary p-1">
            {TOOLS.map(({ id, icon: Icon, labelKey }) => (
              <Tip key={id} label={i18n.t(labelKey)}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTool(id);
                    setSelectedId(null);
                  }}
                  aria-pressed={activeTool === id}
                  className={`flex items-center justify-center w-9 h-8 rounded-lg transition-colors ${
                    activeTool === id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground/75 hover:bg-card hover:text-foreground'
                  }`}
                >
                  <Icon size={16} />
                </button>
              </Tip>
            ))}
            {!hasTarget && (
              <>
                <span className="w-px h-5 bg-border mx-1.5" />
                <Tip label={i18n.t('annotationEditor.addTarget')}>
                  <button
                    type="button"
                    onClick={addTarget}
                    className="flex items-center justify-center w-9 h-8 rounded-lg text-foreground/75 hover:bg-card hover:text-foreground"
                  >
                    <MousePointerClick size={16} />
                  </button>
                </Tip>
              </>
            )}
          </div>

          <div className="flex-1 flex items-center justify-end gap-1.5">
            {mode === 'crop' && viewport && (
              <button
                type="button"
                onClick={() => {
                  setViewport(undefined);
                  gesture.setCropDraft(null);
                }}
                className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[12px] font-semibold text-foreground/75 hover:bg-secondary"
              >
                <RotateCcw size={13} />
                {i18n.t('annotationEditor.resetCrop')}
              </button>
            )}
            <button
              type="button"
              onClick={onCancel}
              className="px-3 h-8 text-[12px] font-semibold text-foreground/75 rounded-lg hover:bg-secondary"
            >
              {i18n.t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleDone}
              disabled={saving}
              className="px-4 h-8 text-[12px] font-bold text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {i18n.t('annotationEditor.done')}
            </button>
          </div>
        </div>
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex items-center justify-center overflow-auto p-6">
            <div className="relative inline-block">
              <canvas
                ref={canvasRef}
                width={screenshot.width}
                height={screenshot.height}
                className="block max-w-full max-h-[calc(100vh-98px)] rounded-lg shadow-2xl touch-none"
                style={{ cursor: cursorFor(mode, activeTool, gesture.hovering, gesture.grabbing) }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
              />
              {textEditor && (
                <input
                  ref={textInputRef}
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  onBlur={commitText}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitText();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setTextEditor(null);
                      setTextValue('');
                    }
                  }}
                  placeholder={i18n.t('annotationEditor.textPlaceholder')}
                  className="absolute z-10 rounded-[2px] border-2 border-accent bg-transparent px-1 outline-none leading-tight"
                  style={{
                    left: textEditor.left,
                    top: textEditor.top - text.fontSize / getScale(),
                    color,
                    fontFamily: FONT_FAMILIES[text.fontFamily],
                    fontSize: `${text.fontSize / getScale()}px`,
                    fontWeight: text.bold ? 700 : 500,
                    fontStyle: text.italic ? 'italic' : 'normal',
                    lineHeight: text.lineHeight,
                    width: `${Math.max(i18n.t('annotationEditor.textPlaceholder').length + 1, textValue.length + 4)}ch`,
                  }}
                />
              )}
              {selected && gesture.anchor && (
                <div
                  className="absolute z-20 -translate-x-1/2 flex flex-col items-center gap-1.5"
                  style={{
                    left: `${((gesture.anchor?.x ?? 0) / screenshot.width) * 100}%`,
                    top: `${((gesture.anchor?.y ?? 0) / screenshot.height) * 100}%`,
                  }}
                >
                  <div className="mt-2 flex items-center gap-1 rounded-xl bg-primary px-2 py-1.5 shadow-xl">
                    {selected.type !== 'redact' && (
                      <ColorPopover
                        label={i18n.t('annotationEditor.lineColor')}
                        value={selected.color}
                        onChange={handleColorSelect}
                      >
                        <button
                          type="button"
                          className="w-6 h-6 rounded-full border-2 border-primary-foreground/25"
                          style={{ backgroundColor: selected.color }}
                        />
                      </ColorPopover>
                    )}
                    {selectedTarget ? (
                      <Tip label={i18n.t('annotationEditor.targetBorder')}>
                        <button
                          type="button"
                          onClick={() =>
                            updateTarget({ border: selectedTarget.border === 'dashed' ? 'solid' : 'dashed' })
                          }
                          className="w-6 h-6 flex items-center justify-center rounded-md text-primary-foreground hover:bg-primary-foreground/15"
                        >
                          {selectedTarget.border === 'dashed' ? <SquareDashed size={14} /> : <Square size={14} />}
                        </button>
                      </Tip>
                    ) : (
                      <Tip label={i18n.t('annotationEditor.duplicate')}>
                        <button
                          type="button"
                          onClick={() => {
                            pushHistory();
                            const copy = { ...moveAnnotation(selected, 24, 24), id: crypto.randomUUID() };
                            setAnnotations((prev) => [...prev, copy]);
                            setSelectedId(copy.id);
                          }}
                          className="w-6 h-6 flex items-center justify-center rounded-md text-primary-foreground hover:bg-primary-foreground/15"
                        >
                          <CopyPlus size={14} />
                        </button>
                      </Tip>
                    )}
                    {(selected.type === 'box' || selected.type === 'ellipse') && (
                      <ColorPopover
                        label={i18n.t('annotationEditor.fillColor')}
                        allowNone
                        value={selected.fill ?? 'transparent'}
                        onChange={(c) => setProp('fill', c)}
                      >
                        <button
                          type="button"
                          className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-primary-foreground/15"
                        >
                          <span
                            className="w-4 h-4 rounded-[3px] border border-primary-foreground/35"
                            style={swatchStyle(selected.fill)}
                          />
                        </button>
                      </ColorPopover>
                    )}
                    {selected.type !== 'text' && selected.type !== 'redact' && selected.type !== 'target' && (
                      <MenuPopover
                        label={i18n.t('annotationEditor.lineWidth')}
                        items={LINE_WIDTH_ORDER.map((w) => (
                          <DropdownMenuItem key={w} onSelect={() => setProp('lineWidth', w)}>
                            <span
                              className={`w-16 rounded-full ${LINE_WIDTHS[w] ? 'bg-foreground' : 'bg-foreground/20'}`}
                              style={{ height: LINE_WIDTHS[w] || 2 }}
                            />
                          </DropdownMenuItem>
                        ))}
                      >
                        <button type="button" className={TOOLBAR_TRIGGER}>
                          <span
                            className={`w-7 rounded-full ${
                              LINE_WIDTHS[selected.lineWidth ?? 'ms']
                                ? 'bg-primary-foreground'
                                : 'bg-primary-foreground/25'
                            }`}
                            style={{ height: LINE_WIDTHS[selected.lineWidth ?? 'ms'] || 2 }}
                          />
                          <ChevronDown size={10} className="opacity-60" />
                        </button>
                      </MenuPopover>
                    )}
                    {selected.type === 'box' && (
                      <Stepper
                        label={i18n.t('annotationEditor.cornerRadius')}
                        value={Math.round(selected.radius ?? 0)}
                        min={0}
                        max={60}
                        step={4}
                        width="w-6"
                        onChange={(v) => setProp('radius', v)}
                      />
                    )}
                    {selected.type === 'arrow' && (
                      <MenuPopover
                        label={i18n.t('annotationEditor.arrowEnd')}
                        items={ARROW_ENDS.map((end) => (
                          <DropdownMenuItem key={end} onSelect={() => setProp('end', end)}>
                            <ArrowEndGlyph end={end} />
                          </DropdownMenuItem>
                        ))}
                      >
                        <button type="button" className={TOOLBAR_TRIGGER}>
                          <ArrowEndGlyph end={selected.end ?? 'arrow-solid'} />
                          <ChevronDown size={10} className="opacity-60" />
                        </button>
                      </MenuPopover>
                    )}
                    {selected.type === 'text' && (
                      <>
                        <DropdownMenu>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  aria-label={i18n.t('annotationEditor.font')}
                                  className="flex items-center gap-1.5 h-6 rounded-md bg-primary-foreground/10 px-2 text-[11px] text-primary-foreground hover:bg-primary-foreground/20"
                                  style={{ fontFamily: FONT_FAMILIES[selected.fontFamily ?? 'sans-serif'] }}
                                >
                                  <span className="text-[13px] leading-none">Ag</span>
                                  <ChevronDown size={10} className="opacity-60" />
                                </button>
                              </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent>{i18n.t('annotationEditor.font')}</TooltipContent>
                          </Tooltip>
                          <DropdownMenuContent align="start" className="min-w-[150px]">
                            {FONT_FAMILY_ORDER.map((f) => (
                              <DropdownMenuItem
                                key={f}
                                onSelect={() => setTextProp({ fontFamily: f })}
                                style={{ fontFamily: FONT_FAMILIES[f] }}
                              >
                                <span className="text-[15px]">Ag</span>
                                <span className="text-[12px] text-muted-foreground">{f}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <div className="flex items-center gap-0.5 rounded-md bg-primary-foreground/10 p-0.5">
                          <Tip label={i18n.t('annotationEditor.bold')}>
                            <button
                              type="button"
                              onClick={() => setTextProp({ bold: !selected.bold })}
                              className={`w-5 h-5 rounded text-[12px] font-extrabold ${selected.bold ? 'bg-accent text-primary-foreground' : 'text-primary-foreground hover:bg-primary-foreground/15'}`}
                            >
                              B
                            </button>
                          </Tip>
                          <Tip label={i18n.t('annotationEditor.italic')}>
                            <button
                              type="button"
                              onClick={() => setTextProp({ italic: !selected.italic })}
                              className={`w-5 h-5 rounded text-[12px] italic font-serif ${selected.italic ? 'bg-accent text-primary-foreground' : 'text-primary-foreground hover:bg-primary-foreground/15'}`}
                            >
                              I
                            </button>
                          </Tip>
                        </div>
                        <Stepper
                          label={i18n.t('annotationEditor.fontSize')}
                          prefix={<span className="text-[9px] text-primary-foreground/60">A</span>}
                          suffix={<span className="text-[13px] text-primary-foreground/60">A</span>}
                          value={Math.round(selected.size)}
                          min={MIN_FONT_SIZE}
                          max={MAX_FONT_SIZE}
                          step={2}
                          width="w-7"
                          onChange={(v) => setTextProp({ size: v })}
                        />
                        <Stepper
                          label={i18n.t('annotationEditor.lineHeight')}
                          prefix={<MoveVertical size={11} className="text-primary-foreground/60" />}
                          value={selected.lineHeight ?? DEFAULT_LINE_HEIGHT}
                          min={MIN_LINE_HEIGHT}
                          max={MAX_LINE_HEIGHT}
                          step={0.1}
                          decimals={1}
                          width="w-7"
                          onChange={(v) => setTextProp({ lineHeight: v })}
                        />
                      </>
                    )}
                    <Tip label={i18n.t('common.delete')}>
                      <button
                        type="button"
                        onClick={() => {
                          pushHistory();
                          setAnnotations((prev) => prev.filter((a) => a.id !== selected.id));
                          setSelectedId(null);
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded-md text-primary-foreground hover:bg-destructive/25"
                      >
                        <Trash2 size={14} />
                      </button>
                    </Tip>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
