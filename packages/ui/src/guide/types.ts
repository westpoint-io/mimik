import type { Screenshot, Step } from '@mimik/core/guides/types';

export interface PreviewData {
  snapshotId: string;
  steps: Step[];
  screenshots: Map<string, Screenshot>;
}
