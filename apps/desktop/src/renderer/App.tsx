import { GuideContent, LibraryContent, navigate, SearchModal, TooltipProvider, TopNav, useRoute } from '@mimik/ui';
import { useEffect, useState } from 'react';
import { CaptureSheet } from './CaptureSheet';
import { GuideZoom } from './GuideZoom';
import { SettingsPanel } from './settings/SettingsPanel';

export function App() {
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
  const [guideKey, setGuideKey] = useState(0);

  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col bg-background">
        <TopNav
          route={route}
          onSettings={library ? () => setSettingsOpen(true) : undefined}
          onNavigate={() => setSettingsOpen(false)}
          guideActions={
            route.page === 'guide' ? (
              <GuideZoom guideId={route.guideId} onDone={() => setGuideKey((n) => n + 1)} />
            ) : undefined
          }
        />
        {settingsOpen ? (
          <main className="flex-1 min-h-0">
            <SettingsPanel />
          </main>
        ) : route.page === 'guide' ? (
          <main className="flex-1 py-10 px-6">
            <div className="mx-auto max-w-[780px]">
              <GuideContent
                key={guideKey}
                guideId={route.guideId}
                initialStepId={route.stepId}
                initialTool={route.tool}
              />
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
