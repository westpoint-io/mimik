import { TooltipProvider } from '@mimik/ui/components/ui/tooltip';
import GuideContent from '@mimik/ui/fullview/GuideContent';
import { useEffect, useState } from 'react';
import CaptureSheet from './CaptureSheet';
import HomeScreen from './HomeScreen';
import SettingsPanel from './SettingsPanel';
import TopBar from './TopBar';

export default function App() {
  const [guideId, setGuideId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const onHash = () => {
      const match = window.location.hash.match(/^#guide\/(.+)$/);
      setGuideId(match ? match[1] : null);
    };
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    window.mimik.capture.onCommand((command, _state, _region, id) => {
      if (command === 'stop' && id) {
        setSettingsOpen(false);
        setSheetOpen(false);
        window.location.hash = `#guide/${id}`;
      }
    });
  }, []);

  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col bg-background">
        <TopBar onSettings={() => setSettingsOpen(true)} />
        {settingsOpen ? (
          <main className="flex-1">
            <SettingsPanel onClose={() => setSettingsOpen(false)} />
          </main>
        ) : guideId ? (
          <main className="flex-1 py-10 px-6">
            <div className="mx-auto max-w-[720px]">
              <GuideContent guideId={guideId} />
            </div>
          </main>
        ) : (
          <HomeScreen
            onOpen={(id) => {
              window.location.hash = `#guide/${id}`;
            }}
            onStart={() => setSheetOpen(true)}
          />
        )}
        {sheetOpen && <CaptureSheet onClose={() => setSheetOpen(false)} />}
      </div>
    </TooltipProvider>
  );
}
