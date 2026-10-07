import type { ReactNode } from 'react';
import type { ValidateKey } from '../ai/types';

export interface StepProps {
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
  index: number;
  total: number;
  validate: ValidateKey;
  requestMicrophoneAccess: () => Promise<void>;
  microphoneAccess?: ReactNode;
  microphoneLocked?: boolean;
}
