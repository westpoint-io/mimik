import { localStorage } from '@/core/env';
import { type ElementMeta, elementSource, type Step } from '@/core/guides/types';

export interface GuideMeSession {
  guideId: string;
  activeStepIndex: number;
  totalSteps: number;
  active: boolean;
}

const SESSION_KEY = 'guideMeSession';
const STEP_KEY = 'guideMeStep';
const BLOCKED_KEY = 'guideMeBlocked';
const MANUAL_KEY = 'guideMeManual';

export async function startSession(
  guideId: string,
  totalSteps: number,
  firstStep: Step,
  requiresManual: boolean,
): Promise<void> {
  const session: GuideMeSession = { guideId, activeStepIndex: 0, totalSteps, active: true };
  await localStorage.set({
    [SESSION_KEY]: session,
    [STEP_KEY]: firstStep,
    [MANUAL_KEY]: requiresManual,
    [BLOCKED_KEY]: requiresManual ? 0 : null,
  });
}

export async function advanceSession(nextStep: Step, nextIndex: number, requiresManual: boolean): Promise<void> {
  const data = await localStorage.get([SESSION_KEY]);
  const session = data[SESSION_KEY] as GuideMeSession | undefined;
  if (!session?.active) return;
  await localStorage.set({
    [SESSION_KEY]: { ...session, activeStepIndex: nextIndex },
    [STEP_KEY]: nextStep,
    [MANUAL_KEY]: requiresManual,
    [BLOCKED_KEY]: requiresManual ? nextIndex : null,
  });
}

export async function completeSession(): Promise<void> {
  const data = await localStorage.get([SESSION_KEY]);
  const session = data[SESSION_KEY] as GuideMeSession | undefined;
  if (!session) return;
  await localStorage.set({
    [SESSION_KEY]: { ...session, active: false },
    [STEP_KEY]: null,
    [MANUAL_KEY]: false,
    [BLOCKED_KEY]: null,
  });
}

export async function cancelSession(): Promise<void> {
  await localStorage.set({ [SESSION_KEY]: null, [STEP_KEY]: null, [MANUAL_KEY]: false, [BLOCKED_KEY]: null });
}

export async function getSession(): Promise<GuideMeSession | null> {
  const data = await localStorage.get([SESSION_KEY]);
  return (data[SESSION_KEY] as GuideMeSession) || null;
}

export { BLOCKED_KEY, MANUAL_KEY, SESSION_KEY, STEP_KEY };

export function isReplayable(step: { elementMeta?: ElementMeta }): boolean {
  return step.elementMeta !== undefined && elementSource(step.elementMeta) === 'dom';
}
