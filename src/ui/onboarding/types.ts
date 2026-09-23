export interface StepProps {
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
  index: number;
  total: number;
}
