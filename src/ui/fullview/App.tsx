import { AppFrame, GuidePage, LibraryContent, SearchModal, TooltipProvider, useRoute } from '@mimik/ui';
import { browser } from '#imports';
import { openSidebar } from '@/lib/browser-api/open-sidebar';
import { UpdateNotice } from '@/ui/shared/UpdateNotice';
import { BackgroundVoiceNotice } from './components/BackgroundVoiceNotice';

export function FullViewApp() {
  const route = useRoute();

  return (
    <TooltipProvider>
      <AppFrame
        route={route}
        onStartCapture={openSidebar}
        onSettings={() => browser.runtime.openOptionsPage()}
        settingsExternal
      >
        <SearchModal />
        <UpdateNotice className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50" />

        {route.page === 'library' && (
          <main className="flex-1 flex flex-col p-8">
            <LibraryContent category={route.category} />
          </main>
        )}

        {route.page === 'guide' && (
          <GuidePage guideId={route.guideId} initialStepId={route.stepId} initialTool={route.tool} />
        )}

        {import.meta.env.BROWSER !== 'firefox' && <BackgroundVoiceNotice />}
      </AppFrame>
    </TooltipProvider>
  );
}
