import { AppFrame, GuideContent, LibraryContent, navigate, SearchModal, TooltipProvider, useRoute } from '@mimik/ui';
import { useEffect, useState } from 'react';
import type { CaptureInsert } from '../main/capture/insert';
import { CaptureSheet } from './CaptureSheet';
import { GuideZoom } from './GuideZoom';
import { REOPEN_SETTINGS } from './settings/lib/reopen-settings';
import { SettingsDialog } from './settings/SettingsDialog';

export function App() {
  const route = useRoute();
  const [settingsOpen, setSettingsOpen] = useState(() => sessionStorage.getItem(REOPEN_SETTINGS) !== null);
  const [sheet, setSheet] = useState<{ insert?: CaptureInsert } | null>(null);
  const [guideKey, setGuideKey] = useState(0);

  useEffect(() => {
    window.mimik.capture.onCommand((command, _state, _region, id) => {
      if (command !== 'stop' || !id) return;
      setSettingsOpen(false);
      setSheet(null);
      navigate({ page: 'guide', guideId: id });
      setGuideKey((n) => n + 1);
    });
  }, []);

  return (
    <TooltipProvider>
      <AppFrame
        route={route}
        onStartCapture={() => setSheet({})}
        onSettings={() => setSettingsOpen(true)}
        guideActions={
          route.page === 'guide' ? (
            <GuideZoom guideId={route.guideId} onDone={() => setGuideKey((n) => n + 1)} />
          ) : undefined
        }
      >
        {route.page === 'guide' ? (
          <main className="flex-1 py-10 px-6">
            <div className="mx-auto max-w-[780px]">
              <GuideContent
                key={guideKey}
                guideId={route.guideId}
                initialStepId={route.stepId}
                initialTool={route.tool}
                onCaptureMore={(insert) => setSheet({ insert })}
              />
            </div>
          </main>
        ) : (
          <main className="flex-1 flex flex-col py-8 px-6">
            <LibraryContent category={route.category} />
          </main>
        )}
      </AppFrame>
      <SearchModal />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      {sheet && <CaptureSheet insert={sheet.insert} onClose={() => setSheet(null)} />}
    </TooltipProvider>
  );
}
