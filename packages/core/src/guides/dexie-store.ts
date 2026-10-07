import { buildFallbackDescription } from '@/core/capture/step-description';
import type { NarrationUpdate } from '@/core/capture/voice/narration-updates';
import type { NarrationTranscript } from '@/core/capture/voice/types';
import { client, i18n } from '@/core/env';
import type { ScreenshotEdits } from '@/core/screenshot/types';
import type { ParsedBundle } from '@/core/transfer/parse';
import { db } from './db';
import { getMostCommonDomain } from './domain';
import { hashPayload } from './snapshot-hash';
import { sanitizeGuideTitle } from './title';
import type {
  BlockType,
  CalloutVariant,
  DescriptionSource,
  ElementMeta,
  Guide,
  GuideTranscript,
  Screenshot,
  Snapshot,
  Step,
  StoredScreenshot,
} from './types';

export type GuideChangeEvent = { type: 'starred'; id: string; starred: boolean } | { type: 'mutated' };

const guidesChannel = new BroadcastChannel('mimik-guides');
const sameWindow = new EventTarget();

export function onGuidesChanged(callback: (event: GuideChangeEvent) => void): () => void {
  const handler = (e: MessageEvent<GuideChangeEvent>) => callback(e.data);
  const local = (e: Event) => callback((e as CustomEvent<GuideChangeEvent>).detail);
  guidesChannel.addEventListener('message', handler);
  sameWindow.addEventListener('change', local);
  return () => {
    guidesChannel.removeEventListener('message', handler);
    sameWindow.removeEventListener('change', local);
  };
}

function notifyGuidesChanged(event: GuideChangeEvent) {
  guidesChannel.postMessage(event);
  if (client() === 'desktop') sameWindow.dispatchEvent(new CustomEvent('change', { detail: event }));
}

async function hydrate(row: StoredScreenshot | undefined): Promise<Screenshot | undefined> {
  if (!row) return undefined;
  if (row.blob) return row as Screenshot;
  if (!row.src) return undefined;
  const response = await fetch(row.src);
  if (!response.ok) return undefined;
  return { ...row, blob: await response.blob() };
}

async function hydrateAll(rows: StoredScreenshot[]): Promise<Screenshot[]> {
  const out = await Promise.all(rows.map((row) => hydrate(row)));
  return out.filter((row): row is Screenshot => row !== undefined);
}

async function createGuide(guideId: string, staging = false): Promise<Guide> {
  const guide: Guide = {
    id: guideId,
    title: i18n.t('guide.untitled'),
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

async function getGuide(
  id: string,
): Promise<{ guide: Guide; steps: Step[]; screenshots: Map<string, Screenshot> } | null> {
  const guide = await db.guides.get(id);
  if (!guide) return null;
  const steps = await db.steps.where('guideId').equals(id).sortBy('index');
  const screenshotIds = steps.map((s) => s.screenshotId).filter(Boolean) as string[];
  const screenshotRows = await hydrateAll(await db.screenshots.where('id').anyOf(screenshotIds).toArray());
  const screenshots = new Map(screenshotRows.map((s) => [s.stepId, s]));
  return { guide, steps, screenshots };
}

async function getGuides(): Promise<Guide[]> {
  return db.guides
    .orderBy('updatedAt')
    .reverse()
    .filter((g) => g.deletedAt == null && !g.staging)
    .toArray();
}

async function getStarredGuides(): Promise<Guide[]> {
  return db.guides
    .orderBy('updatedAt')
    .reverse()
    .filter((g) => g.starred === true && g.deletedAt == null && !g.staging)
    .toArray();
}

async function getTrashedGuides(): Promise<Guide[]> {
  return db.guides
    .orderBy('updatedAt')
    .reverse()
    .filter((g) => g.deletedAt != null)
    .toArray();
}

async function updateGuideTitle(id: string, title: string): Promise<void> {
  await db.guides.update(id, { title: sanitizeGuideTitle(title), updatedAt: Date.now() });
  notifyGuidesChanged({ type: 'mutated' });
}

async function updateGuideDescription(id: string, description: string): Promise<void> {
  await db.guides.update(id, { description, updatedAt: Date.now() });
  notifyGuidesChanged({ type: 'mutated' });
}

async function addStepToGuide(guideId: string, stepId: string): Promise<void> {
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

async function toggleStar(id: string): Promise<boolean> {
  const guide = await db.guides.get(id);
  if (!guide) return false;
  const starred = !guide.starred;
  await db.guides.update(id, { starred });
  notifyGuidesChanged({ type: 'starred', id, starred });
  return starred;
}

async function softDeleteGuide(id: string): Promise<void> {
  await db.guides.update(id, { deletedAt: Date.now(), updatedAt: Date.now() });
  notifyGuidesChanged({ type: 'mutated' });
}

async function restoreGuide(id: string): Promise<void> {
  await db.guides.update(id, { deletedAt: null, updatedAt: Date.now() });
  notifyGuidesChanged({ type: 'mutated' });
}

async function permanentlyDeleteGuide(id: string): Promise<void> {
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
  await db.transcripts.where('guideId').equals(id).delete();
  await db.steps.where('guideId').equals(id).delete();
  await db.guideMerges.delete(id);
  await db.guideMerges.where('targetGuideId').equals(id).delete();
  await db.guides.delete(id);
  notifyGuidesChanged({ type: 'mutated' });
}

async function importGuide(bundle: ParsedBundle): Promise<string> {
  const { manifest, images } = bundle;
  const guideId = crypto.randomUUID();
  const now = Date.now();

  const stepIds = new Map<string, string>();
  for (const step of manifest.steps) stepIds.set(step.id, crypto.randomUUID());

  const screenshotsByStep = new Map(manifest.screenshots.map((shot) => [shot.stepId, shot]));

  const steps: Step[] = [];
  const screenshots: Screenshot[] = [];

  manifest.steps.forEach((incoming, index) => {
    const id = stepIds.get(incoming.id)!;
    const shot = screenshotsByStep.get(incoming.id);
    const blob = shot ? images.get(shot.file) : undefined;
    const screenshotId = shot && blob ? crypto.randomUUID() : undefined;

    if (shot && blob && screenshotId) {
      const { file: _file, ...rest } = shot;
      screenshots.push({ ...rest, id: screenshotId, stepId: id, blob });
    }

    steps.push({
      ...incoming,
      id,
      guideId,
      index,
      aiPending: undefined,
      ...(screenshotId ? { screenshotId } : {}),
    });
  });

  const guide: Guide = {
    id: guideId,
    title: sanitizeGuideTitle(manifest.guide.title),
    ...(manifest.guide.description ? { description: manifest.guide.description } : {}),
    createdAt: now,
    updatedAt: now,
    stepIds: steps.map((s) => s.id),
    starred: false,
    deletedAt: null,
  };

  await db.transaction('rw', db.guides, db.steps, db.screenshots, async () => {
    await db.guides.add(guide);
    await db.steps.bulkAdd(steps);
    if (screenshots.length > 0) await db.screenshots.bulkAdd(screenshots);
  });

  notifyGuidesChanged({ type: 'mutated' });
  return guideId;
}

async function reorderSteps(guideId: string, orderedStepIds: string[]): Promise<void> {
  await db.transaction('rw', db.steps, db.guides, async () => {
    for (let i = 0; i < orderedStepIds.length; i++) {
      await db.steps.update(orderedStepIds[i]!, { index: i });
    }
    await db.guides.update(guideId, { stepIds: orderedStepIds, updatedAt: Date.now() });
  });
}

async function createStep(step: Step): Promise<void> {
  await db.steps.add(step);
}

async function duplicateGuide(guideId: string): Promise<string | null> {
  const copyId = await db.transaction('rw', [db.guides, db.steps, db.screenshots, db.transcripts], async () => {
    const guide = await db.guides.get(guideId);
    if (!guide) return null;
    const steps = await db.steps.where('guideId').equals(guideId).sortBy('index');
    const currentScreenshotIds = steps.map((step) => step.screenshotId).filter((id): id is string => !!id);

    const newGuideId = crypto.randomUUID();
    const stepIdMap = new Map(steps.map((step) => [step.id, crypto.randomUUID()]));
    const screenshotsBelongingToTheseSteps = (
      await db.screenshots.where('id').anyOf(currentScreenshotIds).toArray()
    ).filter((row) => stepIdMap.has(row.stepId));
    const screenshotIdMap = new Map(screenshotsBelongingToTheseSteps.map((row) => [row.id, crypto.randomUUID()]));
    const now = Date.now();

    const { staging: _staging, ...rest } = guide;
    await db.guides.add({
      ...rest,
      id: newGuideId,
      title: sanitizeGuideTitle(i18n.t('library.copyOfTitle', [guide.title])),
      createdAt: now,
      updatedAt: now,
      stepIds: steps.map((step) => stepIdMap.get(step.id)!),
      starred: false,
      deletedAt: null,
    });
    await db.steps.bulkAdd(
      steps.map((step, index) => ({
        ...step,
        id: stepIdMap.get(step.id)!,
        guideId: newGuideId,
        index,
        aiPending: undefined,
        screenshotId: step.screenshotId ? screenshotIdMap.get(step.screenshotId) : undefined,
      })),
    );
    await db.screenshots.bulkAdd(
      screenshotsBelongingToTheseSteps.map((row) => ({
        ...row,
        id: screenshotIdMap.get(row.id)!,
        stepId: stepIdMap.get(row.stepId)!,
      })),
    );
    const transcripts = await db.transcripts.where('guideId').equals(guideId).toArray();
    await db.transcripts.bulkAdd(
      transcripts.map((row) => ({
        ...row,
        id: crypto.randomUUID(),
        guideId: newGuideId,
        lines: row.lines.map((line) => {
          const stepId = line.stepId ? (stepIdMap.get(line.stepId) ?? null) : null;
          if (stepId) return { ...line, stepId };
          const { addedByHand: _addedByHand, ...rest } = line;
          return { ...rest, stepId: null };
        }),
      })),
    );
    return newGuideId;
  });
  if (copyId) notifyGuidesChanged({ type: 'mutated' });
  return copyId;
}

async function mergeGuideInto(sourceGuideId: string, targetGuideId: string, atIndex: number): Promise<number> {
  const moved = await db.transaction('rw', db.steps, db.guides, db.transcripts, db.guideMerges, async () => {
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
    await db.transcripts.where('guideId').equals(sourceGuideId).modify({ guideId: targetGuideId });
    await db.guideMerges.put({ id: sourceGuideId, targetGuideId, mergedAt: Date.now() });
    await db.guides.delete(sourceGuideId);
    return incoming.length;
  });
  if (moved > 0) notifyGuidesChanged({ type: 'mutated' });
  return moved;
}

async function insertBlock(
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

async function updateCallout(stepId: string, variant: CalloutVariant, color?: string): Promise<void> {
  await db.steps.update(stepId, { calloutVariant: variant, calloutColor: color });
}

async function updateStepDescription(stepId: string, description: string, source?: DescriptionSource): Promise<void> {
  await db.steps.update(stepId, source ? { description, descriptionSource: source } : { description });
}

async function applyNarrationToSteps(
  updates: readonly NarrationUpdate[],
  sliceStartMs = Number.NEGATIVE_INFINITY,
): Promise<void> {
  if (updates.length === 0) return;
  await db.transaction('rw', db.steps, async () => {
    for (const update of updates) {
      const step = await db.steps.get(update.stepId);
      if (!step) continue;
      const earlier = step.narratedDescription?.trim();
      const spokenBefore = earlier && step.timestamp < sliceStartMs ? earlier : '';
      const spoken = spokenBefore ? `${spokenBefore} ${update.description}` : update.description;
      if (step.descriptionSource === 'manual') {
        await db.steps.update(step.id, { narratedDescription: spoken, aiPending: false });
        continue;
      }
      await db.steps.update(step.id, {
        description: spoken,
        narratedDescription: spoken,
        descriptionSource: 'narration',
        aiPending: false,
      });
    }
  });
  notifyGuidesChanged({ type: 'mutated' });
}

const MERGE_CHAIN_LIMIT = 10;

async function followMergeChain(guideId: string): Promise<string | null> {
  let current = guideId;
  for (let hop = 0; hop < MERGE_CHAIN_LIMIT; hop++) {
    const merge = await db.guideMerges.get(current);
    if (!merge) return current === guideId ? null : current;
    current = merge.targetGuideId;
  }
  return current;
}

async function resolveTranscriptOwner(guideId: string, transcript: NarrationTranscript): Promise<string | null> {
  if (await db.guides.get(guideId)) return guideId;
  const spokenFor = transcript.lines.map((line) => line.stepId).filter((id): id is string => id !== null);
  const steps = await db.steps.bulkGet(spokenFor);
  const owner = steps.find((step) => step !== undefined)?.guideId ?? (await followMergeChain(guideId));
  return owner && (await db.guides.get(owner)) ? owner : null;
}

async function saveTranscript(guideId: string, transcript: NarrationTranscript): Promise<void> {
  if (transcript.lines.length === 0) return;
  const owner = await resolveTranscriptOwner(guideId, transcript);
  if (!owner) return;
  await db.transcripts.add({
    id: crypto.randomUUID(),
    guideId: owner,
    epochMs: transcript.epochMs,
    createdAt: Date.now(),
    lines: transcript.lines,
  });
  notifyGuidesChanged({ type: 'mutated' });
}

async function getTranscripts(guideId: string): Promise<GuideTranscript[]> {
  return db.transcripts.where('guideId').equals(guideId).toArray();
}

async function hasTranscript(guideId: string): Promise<boolean> {
  return (await db.transcripts.where('guideId').equals(guideId).count()) > 0;
}

function rebuiltHeuristicDescription(step: Step): string {
  if (step.elementMeta) return buildFallbackDescription(step.action, step.elementMeta);
  return step.action === 'navigate' ? i18n.t('steps.navigate') : '';
}

function withoutAppendedSentences(description: string, additions: readonly string[]): string {
  let kept = description.trim();
  let stripped = true;
  while (stripped) {
    stripped = false;
    for (const addition of additions) {
      const sentence = addition.trim();
      if (!sentence) continue;
      if (kept === sentence) return '';
      if (!kept.endsWith(` ${sentence}`)) continue;
      kept = kept.slice(0, -(sentence.length + 1)).trim();
      stripped = true;
    }
  }
  return kept;
}

function withoutSpokenPrefix(description: string, spoken: string | undefined): string {
  if (!spoken) return description;
  if (description === spoken) return '';
  return description.startsWith(`${spoken} `) ? description.slice(spoken.length + 1).trim() : description;
}

function forgetSpokenWords(step: Step, rows: readonly GuideTranscript[]): void {
  const spoken = step.narratedDescription?.trim();
  delete step.narratedDescription;
  if (step.descriptionSource === 'narration') {
    step.description = rebuiltHeuristicDescription(step);
    step.descriptionSource = 'heuristic';
    return;
  }
  const lines = spokenLinesFor(step.id, Boolean(spoken), rows);
  if (!spoken && lines.length === 0) return;
  const original = step.description.trim();
  const kept = withoutSpokenPrefix(withoutAppendedSentences(original, lines), spoken);
  if (kept === original) return;
  if (kept) {
    step.description = kept;
    return;
  }
  step.description = rebuiltHeuristicDescription(step);
  step.descriptionSource = 'heuristic';
}

function spokenLinesFor(stepId: string, narrated: boolean, rows: readonly GuideTranscript[]): string[] {
  return rows.flatMap((row) =>
    row.lines
      .filter((line) =>
        narrated ? line.stepId === null || line.stepId === stepId : line.stepId === stepId && line.addedByHand,
      )
      .map((line) => line.text),
  );
}

async function deleteTranscripts(guideId: string): Promise<void> {
  await db.transaction('rw', db.transcripts, db.steps, db.snapshots, async () => {
    const rows = await db.transcripts.where('guideId').equals(guideId).toArray();
    await db.transcripts.where('guideId').equals(guideId).delete();
    await db.steps
      .where('guideId')
      .equals(guideId)
      .modify((step) => forgetSpokenWords(step, rows));
    await db.snapshots
      .where('guideId')
      .equals(guideId)
      .modify((snapshot) => {
        for (const step of snapshot.steps) forgetSpokenWords(step, rows);
        snapshot.contentHash = hashPayload({
          title: snapshot.title,
          stepIds: snapshot.stepIds,
          steps: snapshot.steps,
          screenshots: snapshot.screenshots,
        });
      });
  });
  notifyGuidesChanged({ type: 'mutated' });
}

async function releaseHandAddedLines(guideId: string, stepId: string): Promise<void> {
  await db.transcripts
    .where('guideId')
    .equals(guideId)
    .modify((row) => {
      for (const line of row.lines) {
        if (line.stepId !== stepId || !line.addedByHand) continue;
        line.stepId = null;
        delete line.addedByHand;
      }
    });
}

async function restoreNarratedDescription(stepId: string): Promise<string | null> {
  const step = await db.steps.get(stepId);
  const spoken = step?.narratedDescription?.trim();
  if (!step || !spoken) return null;
  await db.steps.update(stepId, { description: spoken, descriptionSource: 'narration', aiPending: false });
  await releaseHandAddedLines(step.guideId, stepId);
  notifyGuidesChanged({ type: 'mutated' });
  return spoken;
}

async function markLineAttached(rowId: string, lineIndex: number, stepId: string): Promise<void> {
  await db.transcripts
    .where('id')
    .equals(rowId)
    .modify((row) => {
      const line = row.lines[lineIndex];
      if (!line) return;
      line.stepId = stepId;
      line.addedByHand = true;
    });
}

async function writeAppendedDescription(stepId: string, addition: string): Promise<string | null> {
  const step = await db.steps.get(stepId);
  if (!step) return null;
  const description = step.description.trim() ? `${step.description.trim()} ${addition}` : addition;
  await db.steps.update(stepId, { description, descriptionSource: 'manual', aiPending: false });
  return description;
}

async function isLineStillUnused(rowId: string, lineIndex: number): Promise<boolean> {
  const row = await db.transcripts.get(rowId);
  const line = row?.lines[lineIndex];
  if (!line) return false;
  return !line.stepId || !(await db.steps.get(line.stepId));
}

async function addTranscriptLineToStep(
  rowId: string,
  lineIndex: number,
  stepId: string,
  text: string,
): Promise<string | null> {
  const addition = text.trim();
  if (!addition) return null;
  const description = await db.transaction('rw', db.steps, db.transcripts, async () => {
    if (!(await isLineStillUnused(rowId, lineIndex))) return null;
    const written = await writeAppendedDescription(stepId, addition);
    if (written === null) return null;
    await markLineAttached(rowId, lineIndex, stepId);
    return written;
  });
  if (description !== null) notifyGuidesChanged({ type: 'mutated' });
  return description;
}

async function applyAiDescription(stepId: string, description: string): Promise<void> {
  const wrote = await db.transaction('rw', db.steps, async () => {
    const step = await db.steps.get(stepId);
    if (!step || step.descriptionSource === 'narration') return false;
    await db.steps.update(stepId, { description, descriptionSource: 'ai', aiPending: false });
    return true;
  });
  if (wrote) notifyGuidesChanged({ type: 'mutated' });
}

async function clearStepAiPending(stepId: string, description?: string): Promise<void> {
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

async function getStep(stepId: string): Promise<Step | undefined> {
  return db.steps.get(stepId);
}

async function updateStepInputValue(stepId: string, inputValue: string): Promise<void> {
  await db.steps.update(stepId, { inputValue });
}

async function updateStepCapture(stepId: string, elementMeta: ElementMeta, screenshotId?: string): Promise<void> {
  const updates: Partial<Step> = { elementMeta };
  if (screenshotId) updates.screenshotId = screenshotId;
  await db.steps.update(stepId, updates);
}

async function getStepsForGuide(guideId: string): Promise<Step[]> {
  return db.steps.where('guideId').equals(guideId).sortBy('index');
}

async function findExistingStepIds(stepIds: readonly string[]): Promise<string[]> {
  const found = await db.steps
    .where('id')
    .anyOf([...stepIds])
    .primaryKeys();
  return found as string[];
}

async function deleteSteps(guideId: string, stepIds: readonly string[]): Promise<void> {
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

async function deleteStep(guideId: string, stepId: string): Promise<void> {
  await deleteSteps(guideId, [stepId]);
}

async function getGuideDomain(guideId: string): Promise<string> {
  const steps = await db.steps.where('guideId').equals(guideId).sortBy('index');
  return getMostCommonDomain(steps);
}

async function allScreenshotIds(): Promise<string[]> {
  const ids = new Set<string>();
  await db.screenshots.each((row) => {
    ids.add(row.id);
    const file = row.src ? URL.parse(row.src)?.hostname : undefined;
    if (file) ids.add(file);
  });
  return [...ids];
}

async function saveScreenshot(screenshot: StoredScreenshot): Promise<void> {
  await db.screenshots.add(screenshot);
}

async function replaceScreenshot(
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

async function updateScreenshotEdits(screenshotId: string, edits: ScreenshotEdits): Promise<void> {
  await db.screenshots.update(screenshotId, { edits });
}

async function deleteScreenshot(stepId: string): Promise<void> {
  await db.steps.update(stepId, { screenshotId: undefined });
}

async function getScreenshotsForSteps(stepIds: string[]): Promise<Map<string, Screenshot>> {
  const rows = await hydrateAll(await db.screenshots.where('id').anyOf(stepIds).toArray());
  return new Map(rows.map((s) => [s.stepId, s]));
}

async function getFirstScreenshot(guideId: string): Promise<Screenshot | null> {
  const steps = await db.steps.where('guideId').equals(guideId).sortBy('index');
  for (const step of steps) {
    if (step.screenshotId) {
      const screenshot = await hydrate(await db.screenshots.get(step.screenshotId));
      if (screenshot) return screenshot;
    }
  }
  return null;
}

async function createSnapshot(guideId: string): Promise<Snapshot | null> {
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

async function getSnapshots(guideId: string): Promise<Snapshot[]> {
  return db.snapshots
    .where('[guideId+createdAt]')
    .between([guideId, -Infinity], [guideId, Infinity])
    .reverse()
    .toArray();
}

async function renameSnapshot(snapshotId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  await db.snapshots.update(snapshotId, { name: trimmed === '' ? undefined : trimmed });
}

async function revertToSnapshot(snapshotId: string): Promise<Snapshot | null> {
  const undo = await db.transaction('rw', db.guides, db.steps, db.screenshots, db.snapshots, async () => {
    const snapshot = await db.snapshots.get(snapshotId);
    if (!snapshot) return null;
    const previous = await createSnapshot(snapshot.guideId);
    if (!previous) return null;
    const existing = await db.steps.where('guideId').equals(snapshot.guideId).toArray();
    const keep = new Set(snapshot.steps.map((s) => s.id));
    await db.steps.bulkDelete(existing.filter((s) => !keep.has(s.id)).map((s) => s.id));
    const spoken = new Map(existing.map((step) => [step.id, step.narratedDescription]));
    await db.steps.bulkPut(
      snapshot.steps.map((step) =>
        step.narratedDescription === undefined && spoken.get(step.id) !== undefined
          ? { ...step, narratedDescription: spoken.get(step.id) }
          : step,
      ),
    );
    const live = await db.screenshots.bulkGet(snapshot.screenshots.map((r) => r.id));
    const merged = snapshot.screenshots
      .map((row, i) => (live[i] ? { ...row, blob: live[i]!.blob } : null))
      .filter((r): r is Screenshot => r !== null);
    if (merged.length > 0) await db.screenshots.bulkPut(merged);
    await db.guides.update(snapshot.guideId, {
      title: sanitizeGuideTitle(snapshot.title),
      stepIds: snapshot.stepIds,
      updatedAt: Date.now(),
    });
    return previous;
  });
  if (undo) notifyGuidesChanged({ type: 'mutated' });
  return undo;
}

export const dexieStore = {
  createGuide,
  getGuide,
  getGuides,
  getStarredGuides,
  getTrashedGuides,
  updateGuideTitle,
  updateGuideDescription,
  addStepToGuide,
  toggleStar,
  softDeleteGuide,
  restoreGuide,
  permanentlyDeleteGuide,
  reorderSteps,
  createStep,
  mergeGuideInto,
  insertBlock,
  updateCallout,
  updateStepDescription,
  applyNarrationToSteps,
  applyAiDescription,
  clearStepAiPending,
  getStep,
  updateStepInputValue,
  updateStepCapture,
  getStepsForGuide,
  findExistingStepIds,
  deleteSteps,
  deleteStep,
  getGuideDomain,
  allScreenshotIds,
  saveScreenshot,
  replaceScreenshot,
  updateScreenshotEdits,
  deleteScreenshot,
  getScreenshotsForSteps,
  getFirstScreenshot,
  createSnapshot,
  getSnapshots,
  renameSnapshot,
  revertToSnapshot,
  duplicateGuide,
  importGuide,
  saveTranscript,
  getTranscripts,
  hasTranscript,
  deleteTranscripts,
  addTranscriptLineToStep,
  restoreNarratedDescription,
};
