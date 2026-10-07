import type { DOMContext } from '@/core/capture/dom/context';
import type { ElementMeta } from '@/core/guides/types';

export interface CaptureImage {
  screenshotId: string;
  src: string;
  width: number;
  height: number;
}

export interface CaptureStepData {
  guideId: string;
  action: string;
  elementMeta: ElementMeta;
  domContext?: DOMContext;
  image?: CaptureImage;
}

export type CaptureStepResponse = { stepId: string } | { ignored: true } | { error: string };

export interface UpdateInputStepData {
  stepId: string;
  description: string;
  inputValue?: string;
}

export interface UpdateInputStepResponse {
  updated: boolean;
}

export interface FinalizeInputStepData {
  stepId: string;
  elementMeta: ElementMeta;
  domContext?: DOMContext;
}

export interface FinalizeInputStepResponse {
  updated: boolean;
}

export interface CaptureSink {
  captureStep(data: CaptureStepData): Promise<CaptureStepResponse>;
  updateInputStep(data: UpdateInputStepData): Promise<UpdateInputStepResponse>;
  finalizeInputStep(data: FinalizeInputStepData): Promise<FinalizeInputStepResponse>;
}
