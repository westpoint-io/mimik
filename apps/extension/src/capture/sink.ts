import type { CaptureSink } from '@/core/capture/sink';
import { sendMessage } from '@/lib/messaging';

export const extensionCaptureSink: CaptureSink = {
  captureStep: (data) => sendMessage('captureStep', data),
  updateInputStep: (data) => sendMessage('updateInputStep', data),
  finalizeInputStep: (data) => sendMessage('finalizeInputStep', data),
};
