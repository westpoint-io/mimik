import { i18n } from '#imports';
import type { NarrationUpdate } from '@/core/capture/voice/narration-updates';
import type { ScreenshotEdits } from '@/core/screenshot/types';
import { db } from './db';
import { hashPayload } from './snapshot-hash';
import type { BlockType, CalloutVariant, DescriptionSource, Guide, Screenshot, Snapshot, Step } from './types';

export type GuideChangeEvent = { type: 'starred'; id: string; starred: boolean } | { type: 'mutated' };

const guidesChannel = new BroadcastChannel('mimik-guides');

export function onGuidesChanged(callback: (event: GuideChangeEvent) => void): () => void {
  const handler = (e: MessageEvent<GuideChangeEvent>) => callback(e.data);
  guidesChannel.addEventListener('message', handler);
  return () => guidesChannel.removeEventListener('message', handler);
}

function notifyGuidesChanged(event: GuideChangeEvent) {
  guidesChannel.postMessage(event);
}

export async function createGuide(guideId: string, staging = false): Promise<Guide> {
  const guide: Guide = {
    id: guideId,
    title: i18n.t('fullview.untitledGuide'),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    stepIds: [],
    starred: false,
    deletedAt: null,
    ...(staging ? { staging: true } : {}),
  };
  await db.guides.add(guide);
  return guide;
}

export async function getGuide(
  id: string,
): Promise<{ guide: Guide; steps: Step[]; screenshots: Map<string, Screenshot> } | null> {
  const guide = await db.guides.get(id);
  if (!guide) return null;
  const steps = await db.steps.where('guideId').equals(id).sortBy('index');
  const screenshotIds = steps.map((s) => s.screenshotId).filter(Boolean) as string[];
  const screenshotRows = await db.screenshots.where('id').anyOf(screenshotIds).toArray();
  const screenshots = new Map(screenshotRows.map((s) => [s.stepId, s]));
  return { guide, steps, screenshots };
}

export async function getGuides(): Promise<Guide[]> {
  return db.guides
    .orderBy('updatedAt')
    .reverse()
    .filter((g) => g.deletedAt == null && !g.staging)
    .toArray();
}

export async function getStarredGuides(): Promise<Guide[]> {
  return db.guides
    .orderBy('updatedAt')
    .reverse()
    .filter((g) => g.starred === true && g.deletedAt == null && !g.staging)
    .toArray();
}

export async function getTrashedGuides(): Promise<Guide[]> {
  return db.guides
    .orderBy('updatedAt')
    .reverse()
    .filter((g) => g.deletedAt != null)
    .toArray();
}

export async function updateGuideTitle(id: string, title: string): Promise<void> {
  await db.guides.update(id, { title, updatedAt: Date.now() });
  notifyGuidesChanged({ type: 'mutated' });
}

export async function updateGuideDescription(id: string, description: string): Promise<void> {
  await db.guides.update(id, { description, updatedAt: Date.now() });
  notifyGuidesChanged({ type: 'mutated' });
}

export async function addStepToGuide(guideId: string, stepId: string): Promise<void> {
  await db.transaction('rw', db.guides, async () => {
    const guide = await db.guides.get(guideId);
    if (guide) {
      await db.guides.update(guideId, {
        stepIds: [...guide.stepIds, stepId],
        updatedAt: Date.now(),
      });
    }
  });
}

export async function toggleStar(id: string): Promise<boolean> {
  const guide = await db.guides.get(id);
  if (!guide) return false;
  const starred = !guide.starred;
  await db.guides.update(id, { starred });
  notifyGuidesChanged({ type: 'starred', id, starred });
  return starred;
}

export async function softDeleteGuide(id: string): Promise<void> {
  await db.guides.update(id, { deletedAt: Date.now(), updatedAt: Date.now() });
  notifyGuidesChanged({ type: 'mutated' });
}

export async function restoreGuide(id: string): Promise<void> {
  await db.guides.update(id, { deletedAt: null, updatedAt: Date.now() });
  notifyGuidesChanged({ type: 'mutated' });
}

export async function permanentlyDeleteGuide(id: string): Promise<void> {
  const steps = await db.steps.where('guideId').equals(id).toArray();
  const snapshots = await db.snapshots.where('guideId').equals(id).toArray();
  const stepIds = new Set(steps.map((s) => s.id));
  for (const snapshot of snapshots) {
    for (const step of snapshot.steps) stepIds.add(step.id);
  }
  await db.screenshots
    .where('stepId')
    .anyOf([...stepIds])
    .delete();
  await db.snapshots.where('guideId').equals(id).delete();
  await db.steps.where('guideId').equals(id).delete();
  await db.guides.delete(id);
  notifyGuidesChanged({ type: 'mutated' });
}

export async function reorderSteps(guideId: string, orderedStepIds: string[]): Promise<void> {
  await db.transaction('rw', db.steps, db.guides, async () => {
    for (let i = 0; i < orderedStepIds.length; i++) {
      await db.steps.update(orderedStepIds[i], { index: i });
    }
    await db.guides.update(guideId, { stepIds: orderedStepIds, updatedAt: Date.now() });
  });
}

export async function createStep(step: Step): Promise<void> {
  await db.steps.add(step);
}

export async function mergeGuideInto(sourceGuideId: string, targetGuideId: string, atIndex: number): Promise<number> {
  const moved = await db.transaction('rw', db.steps, db.guides, async () => {
    const incoming = await db.steps.where('guideId').equals(sourceGuideId).sortBy('index');
    const target = await db.steps.where('guideId').equals(targetGuideId).sortBy('index');
    if (incoming.length > 0) {
      target.splice(
        Math.max(0, Math.min(atIndex, target.length)),
        0,
        ...incoming.map((step) => ({ ...step, guideId: targetGuideId })),
      );
      await db.steps.bulkPut(target.map((step, index) => ({ ...step, index })));
      await db.guides.update(targetGuideId, {
        stepIds: target.map((step) => step.id),
        updatedAt: Date.now(),
      });
    }
    await db.guides.delete(sourceGuideId);
    return incoming.length;
  });
  if (moved > 0) notifyGuidesChanged({ type: 'mutated' });
  return moved;
}

export async function insertBlock(
  guideId: string,
  atIndex: number,
  blockType: BlockType,
  description: string,
): Promise<string> {
  const id = crypto.randomUUID();
  await db.transaction('rw', db.steps, db.guides, async () => {
    const steps = await db.steps.where('guideId').equals(guideId).sortBy('index');
    const block: Step = {
      id,
      guideId,
      index: 0,
      description,
      action: blockType,
      url: '',
      timestamp: Date.now(),
      blockType,
      ...(blockType === 'callout' ? { calloutVariant: 'info' as const } : {}),
    };
    steps.splice(Math.max(0, Math.min(atIndex, steps.length)), 0, block);
    await db.steps.bulkPut(steps.map((step, index) => ({ ...step, index })));
    await db.guides.update(guideId, { stepIds: steps.map((step) => step.id), updatedAt: Date.now() });
  });
  return id;
}

export async function updateCallout(stepId: string, variant: CalloutVariant, color?: string): Promise<void> {
  await db.steps.update(stepId, { calloutVariant: variant, calloutColor: color });
}

export async function updateStepDescription(
  stepId: string,
  description: string,
  source?: DescriptionSource,
): Promise<void> {
  await db.steps.update(stepId, source ? { description, descriptionSource: source } : { description });
}

export async function applyNarrationToSteps(updates: readonly NarrationUpdate[]): Promise<void> {
  if (updates.length === 0) return;
  await db.transaction('rw', db.steps, async () => {
    for (const { stepId, description } of updates) {
      await db.steps.update(stepId, { description, descriptionSource: 'narration', aiPending: false });
    }
  });
  notifyGuidesChanged({ type: 'mutated' });
}

export async function applyAiDescription(stepId: string, description: string): Promise<void> {
  const wrote = await db.transaction('rw', db.steps, async () => {
    const step = await db.steps.get(stepId);
    if (!step || step.descriptionSource === 'narration') return false;
    await db.steps.update(stepId, { description, descriptionSource: 'ai', aiPending: false });
    return true;
  });
  if (wrote) notifyGuidesChanged({ type: 'mutated' });
}

export async function clearStepAiPending(stepId: string, description?: string): Promise<void> {
  const wrote = await db.transaction('rw', db.steps, async () => {
    const step = await db.steps.get(stepId);
    if (!step) return false;
    const owned = step.aiPending === true && step.descriptionSource !== 'narration';
    if (description && owned) {
      await db.steps.update(stepId, { description, descriptionSource: 'ai', aiPending: false });
      return true;
    }
    await db.steps.update(stepId, { aiPending: false });
    return step.aiPending === true;
  });
  if (wrote) notifyGuidesChanged({ type: 'mutated' });
}

export async function getStepsForGuide(guideId: string): Promise<Step[]> {
  return db.steps.where('guideId').equals(guideId).sortBy('index');
}

export async function findExistingStepIds(stepIds: readonly string[]): Promise<string[]> {
  const found = await db.steps
    .where('id')
    .anyOf([...stepIds])
    .primaryKeys();
  return found as string[];
}

export async function deleteSteps(guideId: string, stepIds: readonly string[]): Promise<void> {
  if (stepIds.length === 0) return;
  const doomed = new Set(stepIds);
  await db.transaction('rw', db.guides, db.steps, db.screenshots, db.snapshots, async () => {
    const snapshotCount = await db.snapshots.where('guideId').equals(guideId).count();
    if (snapshotCount === 0) {
      const steps = await db.steps.bulkGet([...doomed]);
      const screenshotIds = steps.map((step) => step?.screenshotId).filter((id): id is string => !!id);
      if (screenshotIds.length > 0) await db.screenshots.bulkDelete(screenshotIds);
    }
    await db.steps.bulkDelete([...doomed]);
    const remaining = await db.steps.where('guideId').equals(guideId).sortBy('index');
    await db.steps.bulkPut(remaining.map((step, index) => ({ ...step, index })));
    const guide = await db.guides.get(guideId);
    if (guide) {
      await db.guides.update(guideId, {
        stepIds: guide.stepIds.filter((id) => !doomed.has(id)),
        updatedAt: Date.now(),
      });
    }
  });
}

export async function deleteStep(guideId: string, stepId: string): Promise<void> {
  await deleteSteps(guideId, [stepId]);
}

export async function getGuideDomain(guideId: string): Promise<string> {
  const { getMostCommonDomain } = await import('@/lib/utils');
  const steps = await db.steps.where('guideId').equals(guideId).sortBy('index');
  return getMostCommonDomain(steps);
}

export async function saveScreenshot(screenshot: Screenshot): Promise<void> {
  await db.screenshots.add(screenshot);
}

export async function replaceScreenshot(
  stepId: string,
  blob: Blob,
  dimensions: { width: number; height: number },
  edits?: ScreenshotEdits,
): Promise<string> {
  const id = crypto.randomUUID();
  await db.transaction('rw', db.screenshots, db.steps, async () => {
    await db.screenshots.add({
      id,
      stepId,
      blob,
      mimeType: blob.type,
      width: dimensions.width,
      height: dimensions.height,
      ...(edits ? { edits } : {}),
    });
    await db.steps.update(stepId, { screenshotId: id });
  });
  return id;
}

export async function updateScreenshotEdits(screenshotId: string, edits: ScreenshotEdits): Promise<void> {
  await db.screenshots.update(screenshotId, { edits });
}

export async function deleteScreenshot(stepId: string): Promise<void> {
  await db.steps.update(stepId, { screenshotId: undefined });
}

export async function getScreenshotsForSteps(stepIds: string[]): Promise<Map<string, Screenshot>> {
  const rows = await db.screenshots.where('id').anyOf(stepIds).toArray();
  return new Map(rows.map((s) => [s.stepId, s]));
}

export async function getFirstScreenshot(guideId: string): Promise<Screenshot | null> {
  const steps = await db.steps.where('guideId').equals(guideId).sortBy('index');
  for (const step of steps) {
    if (step.screenshotId) {
      const screenshot = await db.screenshots.get(step.screenshotId);
      if (screenshot) return screenshot;
    }
  }
  return null;
}

export async function createSnapshot(guideId: string): Promise<Snapshot | null> {
  return db.transaction('rw', db.guides, db.steps, db.screenshots, db.snapshots, async () => {
    const guide = await db.guides.get(guideId);
    if (!guide) return null;
    const steps = await db.steps.where('guideId').equals(guideId).sortBy('index');
    const stepIds = steps.map((s) => s.id);
    const rows = await db.screenshots.where('stepId').anyOf(stepIds).toArray();
    const screenshots = rows.map(({ blob, ...rest }) => rest);
    const payload = { title: guide.title, stepIds, steps, screenshots };
    const latest = await db.snapshots
      .where('[guideId+createdAt]')
      .between([guideId, -Infinity], [guideId, Infinity])
      .last();
    const now = Date.now();
    const snapshot: Snapshot = {
      id: crypto.randomUUID(),
      guideId,
      createdAt: latest && latest.createdAt >= now ? latest.createdAt + 1 : now,
      contentHash: hashPayload(payload),
      ...payload,
    };
    await db.snapshots.add(snapshot);
    return snapshot;
  });
}

export async function getSnapshots(guideId: string): Promise<Snapshot[]> {
  return db.snapshots
    .where('[guideId+createdAt]')
    .between([guideId, -Infinity], [guideId, Infinity])
    .reverse()
    .toArray();
}

export async function renameSnapshot(snapshotId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  await db.snapshots.update(snapshotId, { name: trimmed === '' ? undefined : trimmed });
}

export async function revertToSnapshot(snapshotId: string): Promise<Snapshot | null> {
  const undo = await db.transaction('rw', db.guides, db.steps, db.screenshots, db.snapshots, async () => {
    const snapshot = await db.snapshots.get(snapshotId);
    if (!snapshot) return null;
    const previous = await createSnapshot(snapshot.guideId);
    if (!previous) return null;
    const existing = await db.steps.where('guideId').equals(snapshot.guideId).toArray();
    const keep = new Set(snapshot.steps.map((s) => s.id));
    await db.steps.bulkDelete(existing.filter((s) => !keep.has(s.id)).map((s) => s.id));
    await db.steps.bulkPut(snapshot.steps);
    const live = await db.screenshots.bulkGet(snapshot.screenshots.map((r) => r.id));
    const merged = snapshot.screenshots
      .map((row, i) => (live[i] ? { ...row, blob: live[i]!.blob } : null))
      .filter((r): r is Screenshot => r !== null);
    if (merged.length > 0) await db.screenshots.bulkPut(merged);
    await db.guides.update(snapshot.guideId, {
      title: snapshot.title,
      stepIds: snapshot.stepIds,
      updatedAt: Date.now(),
    });
    return previous;
  });
  if (undo) notifyGuidesChanged({ type: 'mutated' });
  return undo;
}
