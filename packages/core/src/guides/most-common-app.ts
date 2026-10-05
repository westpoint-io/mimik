import type { Step } from './types';

type StepApp = NonNullable<Step['app']>;

export function getMostCommonApp(steps: { app?: StepApp }[]): StepApp | null {
  const counts = new Map<string, { app: StepApp; count: number }>();
  for (const step of steps) {
    if (!step.app?.name) continue;
    const seen = counts.get(step.app.name);
    if (seen) seen.count += 1;
    else counts.set(step.app.name, { app: step.app, count: 1 });
  }
  let best: { app: StepApp; count: number } | null = null;
  for (const entry of counts.values()) if (!best || entry.count > best.count) best = entry;
  return best?.app ?? null;
}
