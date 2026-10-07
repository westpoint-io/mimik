import type { GenerateGuideDescriptionResponse } from '@mimik/core/capture/ai/guide-description';
import type { RewriteSelectionResponse } from '@mimik/core/capture/ai/rewrite';

interface TabLike {
  id?: number;
  url?: string;
  title?: string;
  windowId?: number;
  pendingUrl?: string;
}

export interface UiEnv {
  tabs: {
    create(url: string): Promise<TabLike | null>;
  };
  ai: {
    rewriteSelection(text: string, instruction: string): Promise<RewriteSelectionResponse>;
    describeGuide(guideId: string): Promise<GenerateGuideDescriptionResponse>;
  };
  appIconUrl?(id: string): string | null;
}

let current: UiEnv | null = null;

export function configureUi(env: UiEnv): void {
  current = env;
}

function env(): UiEnv {
  if (!current) throw new Error('@mimik/ui is not configured — call configureUi() at the surface entry point');
  return current;
}

export const tabs: UiEnv['tabs'] = {
  create: (url) => env().tabs.create(url),
};

export const ai: UiEnv['ai'] = {
  rewriteSelection: (text, instruction) => env().ai.rewriteSelection(text, instruction),
  describeGuide: (guideId) => env().ai.describeGuide(guideId),
};

export const appIcons = {
  url: (id: string): string | null => current?.appIconUrl?.(id) ?? null,
};
