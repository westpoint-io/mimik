import { GuideContent, LibraryContent, SearchModal, TooltipProvider, TopNav, useFullview, useRoute } from '@mimik/ui';
import { openSidebar } from '@/lib/browser-api/open-sidebar';
import { UpdateNotice } from '@/ui/shared/UpdateNotice';
import { VoiceNotice } from './components/VoiceNotice';

export function FullViewApp() {
  const route = useRoute();
  const historyOpen = useFullview((s) => s.historyOpen);

  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col bg-background">
        <TopNav route={route} />
        <SearchModal />
        <UpdateNotice className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50" />

        {route.page === 'library' && (
          <main className="flex-1 p-8 max-w-6xl mx-auto w-full">
            <LibraryContent category={route.category} onStartCapture={openSidebar} />
          </main>
        )}

        {route.page === 'guide' && (
          <main className="flex-1 py-10 px-6">
            <div className={`mx-auto ${historyOpen ? 'max-w-[1032px]' : 'max-w-[720px]'}`}>
              <GuideContent guideId={route.guideId} initialStepId={route.stepId} initialTool={route.tool} />
            </div>
          </main>
        )}

        {import.meta.env.BROWSER !== 'firefox' && <VoiceNotice />}
      </div>
    </TooltipProvider>
  );
}
