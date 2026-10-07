import { generateDescriptionOnDemand } from '@mimik/core/capture/ai/guide-description';
import { rewriteSelection } from '@mimik/core/capture/ai/rewrite';
import { configureUi } from '@mimik/ui/env';

configureUi({
  tabs: {
    create: async (url) => {
      window.open(url, '_blank');
      return null;
    },
  },
  ai: {
    rewriteSelection,
    describeGuide: generateDescriptionOnDemand,
  },
  appIconUrl: (id) => (/^([/\\]|[A-Za-z]:)/.test(id) ? `mimik-app-icon://icon/?path=${encodeURIComponent(id)}` : null),
});
