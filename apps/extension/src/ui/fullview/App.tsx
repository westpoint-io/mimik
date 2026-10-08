import type { CaptureInsert } from '@mimik/core/capture/capture-insert';
import { AppFrame, GuidePage, LibraryContent, SearchModal, TooltipProvider, UpdateNotice, useRoute } from '@mimik/ui';
import { useState } from 'react';
import { browser } from '#imports';
import { startRecordingInTab } from '@/capture/start-recording-in-tab';
import { openSidebar } from '@/lib/browser-api/open-sidebar';
import { sendMessage } from '@/lib/messaging';
import { useUpdateNotice } from '@/ui/shared/hooks/use-update-notice';
import { BackgroundVoiceNotice } from './components/BackgroundVoiceNotice';
import { CaptureTabDialog } from './components/CaptureTabDialog';

export function FullViewApp() {
  const route = useRoute();
  const [pendingCapture, setPendingCapture] = useState<{ insert?: CaptureInsert } | null>(null);
  const updateNotice = useUpdateNotice();

  return (
    <TooltipProvider>
      <AppFrame
        route={route}
        onStartCapture={() => setPendingCapture({})}
        onSettings={() => browser.runtime.openOptionsPage()}
        settingsExternal
      >
        <SearchModal />
        <UpdateNotice {...updateNotice} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50" />

        {route.page === 'library' && (
          <main className="flex-1 flex flex-col p-8">
            <LibraryContent category={route.category} />
          </main>
        )}

        {route.page === 'guide' && (
          <GuidePage
            guideId={route.guideId}
            initialStepId={route.stepId}
            initialTool={route.tool}
            onCaptureMore={(insert) => setPendingCapture({ insert })}
            onGuideMe={(guideId) => {
              openSidebar();
              void sendMessage('startGuideMe', { guideId });
            }}
          />
        )}

        <CaptureTabDialog
          open={pendingCapture !== null}
          inserting={pendingCapture?.insert !== undefined}
          onCancel={() => setPendingCapture(null)}
          onStart={(tabId) => {
            const target = pendingCapture;
            setPendingCapture(null);
            if (!target) return;
            openSidebar();
            void startRecordingInTab(tabId, target.insert);
          }}
        />

        {import.meta.env.BROWSER !== 'firefox' && <BackgroundVoiceNotice />}
      </AppFrame>
    </TooltipProvider>
  );
}
