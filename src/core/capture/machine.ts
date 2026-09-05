import { assign, createMachine, type SnapshotFrom } from 'xstate';

export const CaptureState = {
  IDLE: 'IDLE',
  RECORDING: 'RECORDING',
  PAUSED: 'PAUSED',
} as const;

export type CaptureStateValue = (typeof CaptureState)[keyof typeof CaptureState];

export function hasActiveRecording(state: CaptureStateValue): boolean {
  return state === CaptureState.RECORDING || state === CaptureState.PAUSED;
}

type CaptureEvent =
  | { type: 'START_RECORDING'; url?: string; insertTargetGuideId?: string; insertAtIndex?: number }
  | { type: 'STOP_RECORDING' }
  | { type: 'PAUSE_CAPTURE' }
  | { type: 'RESUME_CAPTURE' }
  | { type: 'USER_ACTION' }
  | { type: 'URL_CHANGED'; url: string };

interface CaptureContext {
  currentGuideId: string | null;
  stepCount: number;
  currentUrl: string;
  insertTargetGuideId: string | null;
  insertAtIndex: number | null;
}

export const captureMachine = createMachine({
  id: 'capture',
  initial: CaptureState.IDLE,
  types: {} as {
    context: CaptureContext;
    events: CaptureEvent;
  },
  context: {
    currentGuideId: null,
    stepCount: 0,
    currentUrl: '',
    insertTargetGuideId: null,
    insertAtIndex: null,
  },
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
          }),
        },
      },
    },
    [CaptureState.RECORDING]: {
      on: {
        STOP_RECORDING: {
          target: CaptureState.IDLE,
          actions: assign({
            currentGuideId: null,
            stepCount: 0,
            currentUrl: '',
            insertTargetGuideId: null,
            insertAtIndex: null,
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
        PAUSE_CAPTURE: {
          target: CaptureState.PAUSED,
        },
      },
    },
    [CaptureState.PAUSED]: {
      on: {
        RESUME_CAPTURE: {
          target: CaptureState.RECORDING,
        },
        STOP_RECORDING: {
          target: CaptureState.IDLE,
          actions: assign({
            currentGuideId: null,
            stepCount: 0,
            currentUrl: '',
            insertTargetGuideId: null,
            insertAtIndex: null,
          }),
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
