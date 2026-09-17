import { assign, createMachine, type SnapshotFrom } from 'xstate';

export const CaptureState = {
  IDLE: 'IDLE',
  RECORDING: 'RECORDING',
  PAUSED: 'PAUSED',
} as const;

export type CaptureStateValue = (typeof CaptureState)[keyof typeof CaptureState];

/** Why capture is paused: the blur overlay is open, or the user pressed pause. */
export type PauseReason = 'blur' | 'manual';

type CaptureEvent =
  | { type: 'START_RECORDING'; url?: string; insertTargetGuideId?: string; insertAtIndex?: number }
  | { type: 'STOP_RECORDING' }
  | { type: 'PAUSE_CAPTURE'; reason: PauseReason }
  | { type: 'RESUME_CAPTURE' }
  | { type: 'USER_ACTION' }
  | { type: 'URL_CHANGED'; url: string };

interface CaptureContext {
  currentGuideId: string | null;
  stepCount: number;
  currentUrl: string;
  insertTargetGuideId: string | null;
  insertAtIndex: number | null;
  pauseReason: PauseReason | null;
}

const IDLE_CONTEXT: CaptureContext = {
  currentGuideId: null,
  stepCount: 0,
  currentUrl: '',
  insertTargetGuideId: null,
  insertAtIndex: null,
  pauseReason: null,
};

export const captureMachine = createMachine({
  id: 'capture',
  initial: CaptureState.IDLE,
  types: {} as {
    context: CaptureContext;
    events: CaptureEvent;
  },
  context: { ...IDLE_CONTEXT },
  states: {
    [CaptureState.IDLE]: {
      on: {
        START_RECORDING: {
          target: CaptureState.RECORDING,
          actions: assign({
            currentGuideId: () => crypto.randomUUID(),
            stepCount: 0,
            currentUrl: ({ event }) => event.url ?? '',
            insertTargetGuideId: ({ event }) => event.insertTargetGuideId ?? null,
            insertAtIndex: ({ event }) => event.insertAtIndex ?? null,
            pauseReason: null,
          }),
        },
      },
    },
    [CaptureState.RECORDING]: {
      on: {
        STOP_RECORDING: {
          target: CaptureState.IDLE,
          actions: assign({ ...IDLE_CONTEXT }),
        },
        PAUSE_CAPTURE: {
          target: CaptureState.PAUSED,
          actions: assign({
            pauseReason: ({ event }) => event.reason,
          }),
        },
        USER_ACTION: {
          actions: assign({
            stepCount: ({ context }) => context.stepCount + 1,
          }),
        },
        URL_CHANGED: {
          actions: assign({
            currentUrl: ({ event }) => event.url,
          }),
        },
      },
    },
    // No USER_ACTION here on purpose: while paused, nothing can advance the
    // step count, so the "capture paused" label cannot be contradicted by a
    // frame that missed the stop broadcast.
    [CaptureState.PAUSED]: {
      on: {
        RESUME_CAPTURE: {
          target: CaptureState.RECORDING,
          actions: assign({ pauseReason: null }),
        },
        STOP_RECORDING: {
          target: CaptureState.IDLE,
          actions: assign({ ...IDLE_CONTEXT }),
        },
        URL_CHANGED: {
          actions: assign({
            currentUrl: ({ event }) => event.url,
          }),
        },
      },
    },
  },
});

export type CaptureSnapshot = SnapshotFrom<typeof captureMachine>;
