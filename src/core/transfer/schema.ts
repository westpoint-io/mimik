import type {
  BlockType,
  CalloutVariant,
  DescriptionSource,
  ElementMeta,
  ScreenshotBounds,
  Step,
} from '@/core/guides/types';
import type { Annotation, ScreenshotEdits } from '@/core/screenshot/types';

export const BUNDLE_VERSION = 1;

export const BUNDLE_EXTENSION = 'mimik';
export const BUNDLE_MIME = 'application/zip';
export const MANIFEST_PATH = 'manifest.json';
export const SCREENSHOT_DIR = 'screenshots';
export const README_PATH = 'README.md';

export type BundleStep = Omit<Step, 'guideId' | 'aiPending' | 'screenshotId'>;

export interface BundleScreenshot {
  id: string;
  stepId: string;
  file: string;
  mimeType: string;
  width: number;
  height: number;
  bounds?: ScreenshotBounds;
  pixelRatio?: number;
  clickPoint?: { x: number; y: number };
  edits?: ScreenshotEdits;
}

export interface BundleManifest {
  version: number;
  exportedAt: number;
  guide: {
    title: string;
    description?: string;
    createdAt: number;
  };
  sourceDomain: string | null;
  redacted: {
    screenshots: boolean;
    inputValues: boolean;
    urls: 'full' | 'path' | 'origin';
  };
  steps: BundleStep[];
  screenshots: BundleScreenshot[];
}

export type BundleErrorKind = 'unreadable' | 'not-a-bundle' | 'unsupported-version' | 'empty';

export class BundleError extends Error {
  readonly kind: BundleErrorKind;

  constructor(kind: BundleErrorKind, message: string) {
    super(message);
    this.name = 'BundleError';
    this.kind = kind;
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);
const num = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const MAX_DIMENSION = 32_768;
const MAX_POINTS = 20_000;

const bounded = (value: unknown): number | undefined => {
  const n = num(value);
  if (n === undefined) return undefined;
  return Math.max(-MAX_DIMENSION, Math.min(MAX_DIMENSION, n));
};

const positive = (value: unknown): number | undefined => {
  const n = num(value);
  if (n === undefined || n <= 0) return undefined;
  return Math.min(n, MAX_DIMENSION);
};

const SAFE_SCHEMES = ['http:', 'https:'];

export function safeUrl(value: unknown): string {
  const raw = str(value)?.trim();
  if (!raw) return '';
  try {
    return SAFE_SCHEMES.includes(new URL(raw).protocol) ? raw : '';
  } catch {
    return '';
  }
}

const SAFE_IMAGE_TYPES = ['image/webp', 'image/png', 'image/jpeg', 'image/gif'];

function bounds(value: unknown): ScreenshotBounds | undefined {
  if (!isObject(value)) return undefined;
  const x = bounded(value.x);
  const y = bounded(value.y);
  const width = bounded(value.width);
  const height = bounded(value.height);
  if (x === undefined || y === undefined || width === undefined || height === undefined) return undefined;
  return { x, y, width, height };
}

function point(value: unknown): { x: number; y: number } | undefined {
  if (!isObject(value)) return undefined;
  const x = bounded(value.x);
  const y = bounded(value.y);
  return x === undefined || y === undefined ? undefined : { x, y };
}

const DESCRIPTION_SOURCES: DescriptionSource[] = ['narration', 'ai', 'heuristic', 'manual'];
const BLOCK_TYPES: BlockType[] = ['heading', 'callout'];
const CALLOUT_VARIANTS: CalloutVariant[] = ['info', 'warning', 'error', 'success', 'custom'];

const oneOf = <T extends string>(value: unknown, allowed: T[]): T | undefined =>
  typeof value === 'string' && (allowed as string[]).includes(value) ? (value as T) : undefined;

function annotations(value: unknown): Annotation[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const kept = value.filter((a): a is Annotation => {
    if (!isObject(a) || typeof a.id !== 'string' || typeof a.type !== 'string') return false;
    switch (a.type) {
      case 'redact':
        return [a.x, a.y, a.w, a.h].every((n) => bounded(n) !== undefined);
      case 'box':
      case 'ellipse':
      case 'target':
        return [a.x, a.y, a.w, a.h].every((n) => bounded(n) !== undefined) && typeof a.color === 'string';
      case 'arrow':
        return [a.x1, a.y1, a.x2, a.y2].every((n) => bounded(n) !== undefined) && typeof a.color === 'string';
      case 'text':
        return (
          bounded(a.x) !== undefined &&
          bounded(a.y) !== undefined &&
          typeof a.text === 'string' &&
          typeof a.color === 'string' &&
          positive(a.size) !== undefined
        );
      case 'freehand':
        return (
          Array.isArray(a.points) &&
          a.points.length >= 2 &&
          a.points.length % 2 === 0 &&
          a.points.length <= MAX_POINTS &&
          a.points.every((n) => bounded(n) !== undefined) &&
          typeof a.color === 'string'
        );
      default:
        return false;
    }
  });
  return kept.length > 0 ? kept : undefined;
}

function edits(value: unknown): ScreenshotEdits | undefined {
  if (!isObject(value)) return undefined;
  const result: ScreenshotEdits = {};
  const viewport = bounds(value.viewport);
  if (viewport) result.viewport = viewport;
  if (value.target === null) result.target = null;
  else {
    const rect = bounds(value.target);
    if (rect && isObject(value.target)) {
      result.target = {
        ...rect,
        color: str((value.target as Record<string, unknown>).color) ?? '#4F46E5',
        border: oneOf((value.target as Record<string, unknown>).border, ['dashed', 'solid'] as const) ?? 'dashed',
      };
    }
  }
  const list = annotations(value.annotations);
  if (list) result.annotations = list;
  const alt = str(value.alt);
  if (alt) result.alt = alt;
  return Object.keys(result).length > 0 ? result : undefined;
}

function parseStep(value: unknown, index: number, stripInputValues: boolean): BundleStep | null {
  if (!isObject(value)) return null;
  const id = str(value.id);
  if (!id) return null;

  const step: BundleStep = {
    id,
    index: num(value.index) ?? index,
    description: str(value.description) ?? '',
    action: str(value.action) ?? 'click',
    url: safeUrl(value.url),
    timestamp: num(value.timestamp) ?? 0,
  };

  const source = oneOf(value.descriptionSource, DESCRIPTION_SOURCES);
  if (source) step.descriptionSource = source;
  const blockType = oneOf(value.blockType, BLOCK_TYPES);
  if (blockType) step.blockType = blockType;
  const variant = oneOf(value.calloutVariant, CALLOUT_VARIANTS);
  if (variant) step.calloutVariant = variant;
  const color = str(value.calloutColor);
  if (color) step.calloutColor = color;
  const inputValue = str(value.inputValue);
  if (inputValue !== undefined && !stripInputValues) step.inputValue = inputValue;
  const meta = parseElementMeta(value.elementMeta);
  if (meta) step.elementMeta = meta;

  return step;
}

function parseElementMeta(value: unknown): ElementMeta | null {
  if (!isObject(value)) return null;
  const tag = str(value.tag);
  const cssSelector = str(value.cssSelector);
  if (!tag || !cssSelector) return null;

  const nullableStr = (v: unknown): string | null => str(v) ?? null;

  return {
    tag,
    cssSelector,
    textContent: nullableStr(value.textContent),
    ariaLabel: nullableStr(value.ariaLabel),
    placeholder: nullableStr(value.placeholder),
    altText: nullableStr(value.altText),
    name: nullableStr(value.name),
    role: nullableStr(value.role),
    href: safeUrl(value.href) || null,
    inputType: nullableStr(value.inputType),
    dataTestId: nullableStr(value.dataTestId),
    rect: bounds(value.rect) ?? { x: 0, y: 0, width: 0, height: 0 },
    devicePixelRatio: positive(value.devicePixelRatio) ?? 1,
    ...(point(value.clickPoint) ? { clickPoint: point(value.clickPoint) } : {}),
  };
}

function safeEntryPath(file: string): boolean {
  return file.startsWith(`${SCREENSHOT_DIR}/`) && !file.includes('..') && !file.includes('\\');
}

function parseScreenshot(value: unknown): BundleScreenshot | null {
  if (!isObject(value)) return null;
  const id = str(value.id);
  const stepId = str(value.stepId);
  const file = str(value.file);
  const width = positive(value.width);
  const height = positive(value.height);
  if (!id || !stepId || !file || !safeEntryPath(file) || width === undefined || height === undefined) return null;

  const declaredType = str(value.mimeType);
  const shot: BundleScreenshot = {
    id,
    stepId,
    file,
    mimeType: declaredType && SAFE_IMAGE_TYPES.includes(declaredType) ? declaredType : 'image/webp',
    width,
    height,
  };

  const rect = bounds(value.bounds);
  if (rect) shot.bounds = rect;
  const ratio = positive(value.pixelRatio);
  if (ratio !== undefined) shot.pixelRatio = Math.min(ratio, 8);
  const click = point(value.clickPoint);
  if (click) shot.clickPoint = click;
  const editState = edits(value.edits);
  if (editState) shot.edits = editState;

  return shot;
}

export function parseManifest(raw: unknown): BundleManifest {
  if (!isObject(raw)) throw new BundleError('not-a-bundle', 'manifest is not an object');

  const version = num(raw.version);
  if (version === undefined) throw new BundleError('not-a-bundle', 'manifest has no version');
  if (version > BUNDLE_VERSION) {
    throw new BundleError('unsupported-version', `manifest version ${version} is newer than ${BUNDLE_VERSION}`);
  }

  const guide = isObject(raw.guide) ? raw.guide : null;
  if (!guide) throw new BundleError('not-a-bundle', 'manifest has no guide');

  const redacted = isObject(raw.redacted) ? raw.redacted : {};
  const stripInputValues = redacted.inputValues === true;

  const steps = (Array.isArray(raw.steps) ? raw.steps : [])
    .map((value, i) => parseStep(value, i, stripInputValues))
    .filter((step): step is BundleStep => step !== null);
  if (steps.length === 0) throw new BundleError('empty', 'manifest has no usable steps');

  const stepIds = new Set(steps.map((s) => s.id));
  const screenshots = (Array.isArray(raw.screenshots) ? raw.screenshots : [])
    .map(parseScreenshot)
    .filter((shot): shot is BundleScreenshot => shot !== null && stepIds.has(shot.stepId));

  return {
    version,
    exportedAt: num(raw.exportedAt) ?? Date.now(),
    guide: {
      title: str(guide.title)?.trim() || 'Untitled Guide',
      ...(str(guide.description) ? { description: str(guide.description) } : {}),
      createdAt: num(guide.createdAt) ?? Date.now(),
    },
    sourceDomain: str(raw.sourceDomain) ?? null,
    redacted: {
      screenshots: redacted.screenshots === true,
      inputValues: stripInputValues,
      urls: oneOf(redacted.urls, ['full', 'path', 'origin'] as const) ?? 'full',
    },
    steps: steps.sort((a, b) => a.index - b.index),
    screenshots,
  };
}
