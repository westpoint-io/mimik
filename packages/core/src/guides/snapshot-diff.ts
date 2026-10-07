import { resolveTarget } from '@/core/screenshot/geometry';
import type { Annotation, ScreenshotEdits } from '@/core/screenshot/types';
import type { ScreenshotBounds } from './types';

interface DiffStep {
  id: string;
  description: string;
  url?: string;
  screenshotId?: string;
}

interface DiffScreenshot {
  id: string;
  edits?: ScreenshotEdits;
  bounds?: ScreenshotBounds;
  pixelRatio?: number;
}

export interface SnapshotLike {
  title: string;
  stepIds: readonly string[];
  steps: readonly DiffStep[];
  screenshots: readonly DiffScreenshot[];
}

export interface SnapshotDiff {
  titleChanged: boolean;
  added: number;
  removed: number;
  reordered: boolean;
  edited: number;
  urls: number;
  replaced: number;
  cropped: number;
  annotated: number;
  blurred: number;
  altEdited: boolean;
}

function stableStringify(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function rowFor(snapshot: SnapshotLike, screenshotId: string | undefined): DiffScreenshot {
  if (!screenshotId) return { id: '' };
  return snapshot.screenshots.find((row) => row.id === screenshotId) ?? { id: screenshotId };
}

function altOf(edits: ScreenshotEdits): string {
  return edits.alt ?? '';
}

function redactions(edits: ScreenshotEdits): Annotation[] {
  return (edits.annotations ?? []).filter((annotation) => annotation.type === 'redact');
}

function drawings(edits: ScreenshotEdits): Annotation[] {
  return (edits.annotations ?? []).filter((annotation) => annotation.type !== 'redact');
}

function differs(before: unknown, after: unknown): boolean {
  return stableStringify(before) !== stableStringify(after);
}

export function diffSnapshots(from: SnapshotLike, to: SnapshotLike): SnapshotDiff {
  const fromIds = new Set(from.stepIds);
  const toIds = new Set(to.stepIds);

  const added = to.stepIds.filter((id) => !fromIds.has(id)).length;
  const removed = from.stepIds.filter((id) => !toIds.has(id)).length;

  const survivorsBefore = from.stepIds.filter((id) => toIds.has(id));
  const survivorsAfter = to.stepIds.filter((id) => fromIds.has(id));
  const reordered = survivorsBefore.some((id, i) => survivorsAfter[i] !== id);

  const fromSteps = new Map(from.steps.map((s) => [s.id, s]));
  let edited = 0;
  let urls = 0;
  let replaced = 0;
  let cropped = 0;
  let annotated = 0;
  let blurred = 0;
  let altEdited = false;

  for (const step of to.steps) {
    const before = fromSteps.get(step.id);
    if (!before) continue;

    if (before.description !== step.description) edited++;
    if (before.url !== step.url) urls++;
    if (before.screenshotId !== step.screenshotId) {
      replaced++;
      continue;
    }

    const beforeRow = rowFor(from, before.screenshotId);
    const afterRow = rowFor(to, step.screenshotId);
    const beforeEdits = beforeRow.edits ?? {};
    const afterEdits = afterRow.edits ?? {};

    const byHand = beforeEdits.zoomLevel === undefined || afterEdits.zoomLevel === undefined;
    if (byHand && differs(beforeEdits.viewport, afterEdits.viewport)) cropped++;
    if (
      differs(drawings(beforeEdits), drawings(afterEdits)) ||
      differs(resolveTarget(beforeRow), resolveTarget(afterRow))
    )
      annotated++;
    if (differs(redactions(beforeEdits), redactions(afterEdits))) blurred++;
    if (altOf(beforeEdits) !== altOf(afterEdits)) altEdited = true;
  }

  return {
    titleChanged: from.title !== to.title,
    added,
    removed,
    reordered,
    edited,
    urls,
    replaced,
    cropped,
    annotated,
    blurred,
    altEdited,
  };
}
