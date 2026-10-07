import { generateDescriptionOnDemand } from '@mimik/core/capture/ai/guide-description';
import { rewriteSelection } from '@mimik/core/capture/ai/rewrite';
import { configureUi } from '@mimik/ui/env';

const unsupported = async (): Promise<never> => {
  throw new Error('this action needs the browser extension');
};

const HANDLERS: Record<string, (payload: never) => Promise<unknown>> = {
  rewriteSelection: ({ text, instruction }: { text: string; instruction: string }) =>
    rewriteSelection(text, instruction),
  generateGuideDescription: ({ guideId }: { guideId: string }) => generateDescriptionOnDemand(guideId),
};

configureUi({
  tabs: {
    create: async (url) => {
      window.open(url, '_blank');
      return null;
    },
    recordable: async () => [],
    startInsertRecording: unsupported,
  },
  panel: {
    open: () => undefined,
  },
  send: (name, payload) => (HANDLERS[name] ?? unsupported)(payload as never) as never,
  appIconUrl: (id) => (/^([/\\]|[A-Za-z]:)/.test(id) ? `mimik-app-icon://icon/?path=${encodeURIComponent(id)}` : null),
});
