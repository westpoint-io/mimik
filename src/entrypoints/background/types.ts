import type { createActor } from 'xstate';
import type { captureMachine } from '@/core/capture/machine';

export type ActorRef = ReturnType<typeof createActor<typeof captureMachine>>;
