import { assign, type SnapshotFrom, setup } from 'xstate';

export const CaptureState = {
  IDLE: 'IDLE',
  ARMED: 'ARMED',
  RECORDING: 'RECORDING',
  PAUSED: 'PAUSED',
} as const;

export type CaptureStateValue = (typeof CaptureState)[keyof typeof CaptureState];

export type PauseReason = 'blur' | 'manual' | 'area';

type CaptureEvent =
  | { type: 'ARM' }
  | { type: 'DISARM' }
  | { type: 'START_RECORDING'; url?: string; insertTargetGuideId?: string; insertAtIndex?: number }
  | { type: 'STOP_RECORDING' }
  | { type: 'PAUSE_CAPTURE'; reason: PauseReason; narrationWasLive?: boolean }
  | { type: 'RESUME_CAPTURE' }
  | { type: 'USER_ACTION' }
  | { type: 'STEP_REMOVED' }
  | { type: 'URL_CHANGED'; url: string };

interface CaptureContext {
  currentGuideId: string | null;
  stepCount: number;
  currentUrl: string;
  insertTargetGuideId: string | null;
  insertAtIndex: number | null;
  pauseReason: PauseReason | null;
  narrationWasLive: boolean;
}

const IDLE_CONTEXT: CaptureContext = {
  currentGuideId: null,
  stepCount: 0,
  currentUrl: '',
  insertTargetGuideId: null,
  insertAtIndex: null,
  pauseReason: null,
  narrationWasLive: false,
};

export const captureMachine = setup({
  types: {} as {
    context: CaptureContext;
    events: CaptureEvent;
  },
  actions: {
    beginGuide: assign(({ event }) =>
      event.type === 'START_RECORDING'
        ? {
            currentGuideId: crypto.randomUUID(),
            stepCount: 0,
            currentUrl: event.url ?? '',
            insertTargetGuideId: event.insertTargetGuideId ?? null,
            insertAtIndex: event.insertAtIndex ?? null,
            pauseReason: null,
            narrationWasLive: false,
          }
        : {},
    ),
    removeStep: assign({ stepCount: ({ context }) => Math.max(0, context.stepCount - 1) }),
  },
}).createMachine({
  id: 'capture',
  initial: CaptureState.IDLE,
  context: { ...IDLE_CONTEXT },
  states: {
    [CaptureState.IDLE]: {
      on: {
        ARM: { target: CaptureState.ARMED },
        START_RECORDING: { target: CaptureState.RECORDING, actions: 'beginGuide' },
      },
    },
    [CaptureState.ARMED]: {
      on: {
        DISARM: { target: CaptureState.IDLE },
        START_RECORDING: { target: CaptureState.RECORDING, actions: 'beginGuide' },
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
            narrationWasLive: ({ event }) => event.narrationWasLive === true,
          }),
        },
        USER_ACTION: {
          actions: assign({
            stepCount: ({ context }) => context.stepCount + 1,
          }),
        },
        STEP_REMOVED: { actions: 'removeStep' },
        URL_CHANGED: {
          actions: assign({
            currentUrl: ({ event }) => event.url,
          }),
        },
      },
    },
    [CaptureState.PAUSED]: {
      on: {
        RESUME_CAPTURE: {
          target: CaptureState.RECORDING,
          actions: assign({ pauseReason: null, narrationWasLive: false }),
        },
        STEP_REMOVED: { actions: 'removeStep' },
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
