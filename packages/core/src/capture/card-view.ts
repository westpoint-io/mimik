import type { DescriptionSource } from '../guides/types';
import type { AiFailureUpdate } from './ai/errors';
import type { CaptureStateValue, PauseReason } from './machine';
import type { VoiceErrorReason } from './voice/voice-update';

export type CardCommand =
  | 'start'
  | 'disarm'
  | 'stop'
  | 'pause'
  | 'resume'
  | 'discard'
  | 'deleteStep'
  | 'narration:start'
  | 'narration:stop';

export interface CardStep {
  id: string;
  number: number;
  title: string;
  action: string;
  src: string;
  source: DescriptionSource;
  pending: boolean;
  app: string | null;
}

export interface CardProgress {
  percent: number;
  ms: number;
}

export interface CardShortcuts {
  record: string | null;
  capture: string | null;
}

export interface CardNarration {
  level: number;
  speaking: boolean;
  reason?: VoiceErrorReason;
}

interface CardAim {
  x: number;
  y: number;
  aspect: number;
}

export interface CardPrint {
  src: string | null;
  aim: CardAim | null;
}

export interface CardView {
  state: CaptureStateValue;
  pauseReason: PauseReason | null;
  step: CardStep | null;
  busy: boolean;
  progress: CardProgress;
  print: CardPrint;
  starting: boolean;
  shortcuts: CardShortcuts;
  aiFailure: AiFailureUpdate | null;
  narration: CardNarration | null;
}
