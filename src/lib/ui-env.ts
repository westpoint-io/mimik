import { configureUi } from '@mimik/ui/env';
import { createTab } from '@/lib/browser-api/create-tab';
import { sendMessage } from '@/lib/messaging';

configureUi({
  tabs: {
    create: (url) => createTab({ url }) as never,
  },
  ai: {
    rewriteSelection: (text, instruction) => sendMessage('rewriteSelection', { text, instruction }),
    describeGuide: (guideId) => sendMessage('generateGuideDescription', { guideId }),
  },
});
