import type { CaptureInsert } from '@mimik/core/capture/capture-insert';
import { i18n, localStorage } from '@mimik/core/env';
import {
  AppFrame,
  GuidePage,
  LibraryContent,
  navigate,
  SearchModal,
  TooltipProvider,
  UpdateNotice,
  useFullview,
  useRoute,
  VoiceNotice,
} from '@mimik/ui';
import { useCallback, useEffect, useState } from 'react';
import { CaptureSheet } from './CaptureSheet';
import { DesktopOnboarding } from './DesktopOnboarding';
import { GuideZoom } from './GuideZoom';
import { useNarrationUpdate } from './hooks/use-narration-update';
import { useUpdateNotice } from './hooks/use-update-notice';
import { PermissionsDialog } from './PermissionsDialog';
import { REOPEN_SETTINGS } from './settings/lib/reopen-settings';
import { SettingsDialog } from './settings/SettingsDialog';

export function App() {
  const route = useRoute();
  const narration = useNarrationUpdate();
  const [settingsOpen, setSettingsOpen] = useState(() => sessionStorage.getItem(REOPEN_SETTINGS) !== null);
  const [settingsOnKeys, setSettingsOnKeys] = useState(false);
  const updateNotice = useUpdateNotice();
  const [sheet, setSheet] = useState<{ insert?: CaptureInsert } | null>(null);
  const [guideKey, setGuideKey] = useState(0);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [version, setVersion] = useState('');
  const setImportFile = useFullview((s) => s.setImportFile);

  useEffect(() => {
    const take = () =>
      void window.mimik.openedFile.take().then((opened) => {
        if (!opened) return;
        setSettingsOpen(false);
        setSheet(null);
        navigate({ page: 'library', category: 'all' });
        setImportFile(new File([new Uint8Array(opened.bytes)], opened.name));
      });
    take();
    window.mimik.openedFile.onOpen(take);
  }, [setImportFile]);

  useEffect(() => {
    void window.mimik.version().then(setVersion);
    window.mimik.permissions.onShow(() => setPermissionsOpen(true));
    window.mimik.capture.onOpenSheet(() => setSheet({}));
    window.mimik.onOpen((target) => {
      setSettingsOpen(target === 'settings');
      setSheet(target === 'capture' ? {} : null);
      if (target === 'library') navigate({ page: 'library', category: 'all' });
    });
    void window.mimik.permissions.get().then((found) => found.pending && setPermissionsOpen(true));
  }, []);

  const closePermissions = useCallback((granted: boolean) => {
    setPermissionsOpen(false);
    if (granted) window.mimik.permissions.continue();
    else window.mimik.permissions.cancel();
  }, []);

  useEffect(() => {
    void localStorage.get(['onboardingCompleted']).then((stored) => setOnboarded(stored.onboardingCompleted === true));
  }, []);

  useEffect(() => {
    window.mimik.capture.onStateUpdate(({ command, currentGuideId: id }) => {
      if (command !== 'stop' || !id) return;
      setSettingsOpen(false);
      setSheet(null);
      navigate({ page: 'guide', guideId: id });
      setGuideKey((n) => n + 1);
    });
  }, []);

  if (onboarded === null) return null;

  if (!onboarded) {
    return (
      <TooltipProvider>
        <DesktopOnboarding onFinish={() => setOnboarded(true)} />
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <AppFrame
        route={route}
        onStartCapture={() => setSheet({})}
        onSettings={() => setSettingsOpen(true)}
        version={version && i18n.t('desktop.version', [version])}
        guideActions={
          route.page === 'guide' ? (
            <GuideZoom guideId={route.guideId} onDone={() => setGuideKey((n) => n + 1)} />
          ) : undefined
        }
      >
        {route.page === 'guide' ? (
          <GuidePage
            key={guideKey}
            guideId={route.guideId}
            initialStepId={route.stepId}
            initialTool={route.tool}
            onCaptureMore={(insert) => setSheet({ insert })}
          />
        ) : (
          <main className="flex-1 flex flex-col py-8 px-6">
            <LibraryContent category={route.category} />
          </main>
        )}
      </AppFrame>
      <SearchModal />
      <SettingsDialog
        open={settingsOpen}
        startOnKeys={settingsOnKeys}
        onOpenChange={(open) => {
          setSettingsOpen(open);
          if (!open) setSettingsOnKeys(false);
        }}
      />
      <VoiceNotice
        update={narration.update}
        seenLive={narration.seenLive}
        onOpenSettings={() => {
          setSettingsOnKeys(true);
          setSettingsOpen(true);
        }}
      />
      <UpdateNotice {...updateNotice} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50" />
      {sheet && <CaptureSheet insert={sheet.insert} onClose={() => setSheet(null)} />}
      <PermissionsDialog open={permissionsOpen} onClose={closePermissions} />
    </TooltipProvider>
  );
}
