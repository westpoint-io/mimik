import type { CardPrint, CardProgress, CardStep } from '@/core/capture/card-view';
import { extractDomain } from '@/core/guides/domain';
import { getScreenshotsForSteps, getStep, getStepsForGuide } from '@/core/guides/service';
import { broadcastCardToPanel } from '@/lib/port/broadcast-card-to-panel';
import type { PanelCardUpdate } from '@/lib/port/types';
import { blobToDataUrl } from './blob-to-data-url';

const MIN_PRINT_MS = 1400;
const REPLAY_STALE_MS = 15000;
const REPLAY_LAND_MS = 450;
const SETTLE_POLL_MS = 800;
const NO_PRINT: CardPrint = { src: null, aim: null };
const NO_PROGRESS: CardProgress = { percent: 0, ms: 0 };

let steps: CardStep[] = [];
let busy = false;
let busySince = 0;
let progress = NO_PROGRESS;
let print = NO_PRINT;
let release: ReturnType<typeof setTimeout> | null = null;
let settle: ReturnType<typeof setTimeout> | null = null;
let replay: ReturnType<typeof setTimeout> | null = null;
let lastStepAt = 0;
let lastAttachAt = 0;

function view(): PanelCardUpdate {
  return { type: 'CARD_UPDATE', step: steps.at(-1) ?? null, busy, progress, print };
}

function send(): void {
  broadcastCardToPanel(view());
}

function watchPending(): void {
  if (settle) clearTimeout(settle);
  settle = null;
  const last = steps.at(-1);
  if (!last?.pending) return;
  settle = setTimeout(async () => {
    const stored = await getStep(last.id).catch(() => undefined);
    if (stored && stored.aiPending !== true) {
      cardFeed.update(last.id, {
        title: stored.description,
        source: stored.descriptionSource ?? 'heuristic',
        pending: false,
      });
      return;
    }
    watchPending();
  }, SETTLE_POLL_MS);
}

export const cardFeed = {
  current: view,

  attach(): PanelCardUpdate {
    const capturing = busy && release === null;
    if (release) {
      clearTimeout(release);
      release = null;
    }
    if (replay) {
      clearTimeout(replay);
      replay = null;
    }
    busy = false;
    progress = NO_PROGRESS;
    print = NO_PRINT;
    const last = steps.at(-1);
    const fresh = lastStepAt > lastAttachAt && Date.now() - lastStepAt < REPLAY_STALE_MS;
    lastAttachAt = Date.now();
    if (!capturing && fresh && last?.src) {
      const prior = steps.length > 1 ? (steps[steps.length - 2] ?? null) : null;
      replay = setTimeout(() => {
        replay = null;
        send();
      }, REPLAY_LAND_MS);
      return {
        type: 'CARD_UPDATE',
        step: prior,
        busy: true,
        progress: { percent: 100, ms: 150 },
        print: { src: last.src, aim: null },
      };
    }
    return view();
  },

  setBusy(next: boolean): void {
    if (release) clearTimeout(release);
    release = null;
    if (next) {
      if (!busy) busySince = Date.now();
      busy = true;
      progress = NO_PROGRESS;
      print = NO_PRINT;
      send();
      return;
    }
    const left = MIN_PRINT_MS - (Date.now() - busySince);
    const done = () => {
      busy = false;
      send();
    };
    if (left > 0) release = setTimeout(done, left);
    else done();
  },

  setPrint(patch: Partial<CardPrint>): void {
    print = { ...print, ...patch };
    send();
  },

  setProgress(percent: number, ms: number): void {
    progress = { percent, ms };
    send();
  },

  add(step: Omit<CardStep, 'number' | 'app'> & { url: string }): CardStep {
    const { url, ...rest } = step;
    const added = { ...rest, number: steps.length + 1, app: extractDomain(url) || null };
    steps.push(added);
    lastStepAt = Date.now();
    if (added.pending) this.setProgress(95, 3500);
    else send();
    watchPending();
    return added;
  },

  update(stepId: string, patch: Partial<Pick<CardStep, 'title' | 'source' | 'pending' | 'src'>>): void {
    const step = steps.find((candidate) => candidate.id === stepId);
    if (!step) return;
    Object.assign(step, patch);
    if (step !== steps.at(-1)) return;
    if (patch.pending === false) progress = { percent: 100, ms: 200 };
    send();
    watchPending();
  },

  remove(stepId: string): void {
    steps = steps.filter((step) => step.id !== stepId);
    steps.forEach((step, index) => {
      step.number = index + 1;
    });
    send();
  },

  reset(): void {
    if (replay) {
      clearTimeout(replay);
      replay = null;
    }
    steps = [];
    lastStepAt = 0;
    lastAttachAt = 0;
    this.setBusy(false);
  },

  async hydrate(guideId: string): Promise<void> {
    if (steps.length > 0) return;
    const stored = await getStepsForGuide(guideId);
    const shots = await getScreenshotsForSteps(
      stored.flatMap((step) => (step.screenshotId ? [step.screenshotId] : [])),
    );
    steps = await Promise.all(
      stored.map(async (step, index) => {
        const shot = shots.get(step.id);
        return {
          id: step.id,
          number: index + 1,
          title: step.description,
          action: step.action,
          src: shot ? await blobToDataUrl(shot.blob) : '',
          source: step.descriptionSource ?? 'heuristic',
          pending: step.aiPending === true,
          app: extractDomain(step.url) || null,
        };
      }),
    );
    watchPending();
  },
};
