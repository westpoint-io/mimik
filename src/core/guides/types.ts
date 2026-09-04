import type { VoiceProvider } from '@/core/capture/voice/transcribe';
import type { ScreenshotEdits } from '@/core/screenshot/types';

export interface Guide {
  id: string;
  title: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  stepIds: string[];
  starred: boolean;
  deletedAt: number | null;
  staging?: boolean;
}

export type DescriptionSource = 'narration' | 'ai' | 'heuristic';

export type BlockType = 'heading' | 'callout';

export type CalloutVariant = 'info' | 'warning' | 'error' | 'success' | 'custom';

export interface Step {
  id: string;
  guideId: string;
  index: number;
  description: string;
  action: string;
  url: string;
  timestamp: number;
  screenshotId?: string;
  elementMeta?: ElementMeta;
  inputValue?: string;
  descriptionSource?: DescriptionSource;
  aiPending?: boolean;
  blockType?: BlockType;
  calloutVariant?: CalloutVariant;
  calloutColor?: string;
}

export interface ScreenshotBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Screenshot {
  id: string;
  stepId: string;
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  bounds?: ScreenshotBounds;
  pixelRatio?: number;
  clickPoint?: { x: number; y: number };
  edits?: ScreenshotEdits;
}

export interface Settings {
  aiApiKey: string;
  aiProvider: 'openai' | 'anthropic' | 'openrouter';
  aiModel: string;
  voiceEnabled: boolean;
  voiceProvider: VoiceProvider;
  voiceApiKey: string;
  voiceMicrophoneId: string;
}

export interface ElementMeta {
  tag: string;
  cssSelector: string;
  textContent: string | null;
  ariaLabel: string | null;
  placeholder: string | null;
  altText: string | null;
  name: string | null;
  role: string | null;
  href: string | null;
  inputType: string | null;
  dataTestId: string | null;
  rect: { x: number; y: number; width: number; height: number };
  devicePixelRatio: number;
  clickPoint?: { x: number; y: number };
}

export interface Snapshot {
  id: string;
  guideId: string;
  createdAt: number;
  contentHash: string;
  name?: string;
  title: string;
  stepIds: string[];
  steps: Step[];
  screenshots: Omit<Screenshot, 'blob'>[];
}
