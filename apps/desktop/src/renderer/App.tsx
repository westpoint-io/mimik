import { TooltipProvider } from '@mimik/ui/components/ui/tooltip';
import GuideContent from '@mimik/ui/fullview/GuideContent';
import LibraryContent from '@mimik/ui/fullview/LibraryContent';
import { navigate, useRoute } from '@mimik/ui/fullview/router';
import SearchModal from '@mimik/ui/fullview/SearchModal';
import TopNav from '@mimik/ui/fullview/TopNav';
import { useEffect, useState } from 'react';
import CaptureSheet from './CaptureSheet';
import SettingsPanel from './SettingsPanel';

export default function App() {
  const route = useRoute();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    window.mimik.capture.onCommand((command, _state, _region, id) => {
      if (command !== 'stop' || !id) return;
      setSettingsOpen(false);
      setSheetOpen(false);
      navigate({ page: 'guide', guideId: id });
    });
  }, []);

  const library = route.page === 'library';

  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col bg-background">
        <TopNav route={route} onSettings={library ? () => setSettingsOpen(true) : undefined} />
        {settingsOpen ? (
          <main className="flex-1 min-h-0">
            <SettingsPanel onClose={() => setSettingsOpen(false)} />
          </main>
        ) : route.page === 'guide' ? (
          <main className="flex-1 py-10 px-6">
            <div className="mx-auto max-w-[780px]">
              <GuideContent guideId={route.guideId} initialStepId={route.stepId} initialTool={route.tool} />
            </div>
          </main>
        ) : (
          <main className="flex-1 py-8 px-6">
            <LibraryContent category={route.category} onStartCapture={() => setSheetOpen(true)} />
          </main>
        )}
        <SearchModal />
        {sheetOpen && <CaptureSheet onClose={() => setSheetOpen(false)} />}
      </div>
    </TooltipProvider>
  );
}
