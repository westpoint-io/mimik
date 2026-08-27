import { Globe, Search, Settings, Video } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { browser, i18n } from '#imports';
import { CaptureState } from '@/core/capture/machine';
import { isRecordableUrl } from '@/core/capture/recordable-tabs';
import type { GuideMeSession } from '@/core/guideme/session';
import { SESSION_KEY } from '@/core/guideme/session';
import {
  createTab,
  focusWindow,
  getActiveTab,
  getExtensionURL,
  queryTabs,
  requestHostPermissions,
  updateTab,
} from '@/lib/browser-api';
import { logger } from '@/lib/logger';
import { sendMessage } from '@/lib/messaging';
import { getVoiceStatus } from '@/lib/offscreen';
import { connectToBackground, type PanelVoiceUpdate } from '@/lib/port';
import { Button } from '@/ui/components/ui/button';
import { Input } from '@/ui/components/ui/input';
import { TooltipProvider } from '@/ui/components/ui/tooltip';
import SettingsView from '@/ui/shared/SettingsView';
import UpdateNotice from '@/ui/shared/UpdateNotice';
import GuideEditor from './GuideEditor';
import GuideMeCompletion from './GuideMeCompletion';
import GuideMeView from './GuideMeView';
import LibraryView from './LibraryView';
import RecordingView from './RecordingView';
import VoiceToast from './VoiceToast';

type View =
  | { name: 'library' }
  | { name: 'editor'; guideId: string }
  | { name: 'recording'; guideId: string }
  | { name: 'settings' }
  | { name: 'guideme'; guideId: string }
  | { name: 'guideme-done'; guideId: string };

function MascotIcon({ size = 44 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width={size} height={size}>
      <defs>
        <clipPath id="cc">
          <circle cx="100" cy="100" r="95" />
        </clipPath>
        <clipPath id="ds">
          <path d="M30 95 L170 60 L170 95 Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#cc)">
        <rect x="-50" y="-50" width="300" height="300" className="fill-lavender" />
        <rect
          x="30"
          y="-80"
          width="50"
          height="400"
          className="fill-accent"
          transform="rotate(45, 100, 100)"
          opacity="0.15"
        />
        <rect x="90" y="-80" width="50" height="400" fill="#818CF8" transform="rotate(45, 100, 100)" opacity="0.12" />
        <rect x="-30" y="-80" width="50" height="400" fill="#93C5FD" transform="rotate(45, 100, 100)" opacity="0.15" />
        <rect x="150" y="-80" width="50" height="400" fill="#A5B4FC" transform="rotate(45, 100, 100)" opacity="0.1" />
      </g>
      <rect x="30" y="95" width="140" height="68" rx="5" className="fill-primary" />
      <path d="M30 95 L30 80 Q30 60, 100 60 Q170 60, 170 80 L170 95 Z" className="fill-violet-mid" />
      <path d="M30 95 L30 80 Q30 60, 100 60 Q170 60, 170 80 L170 95 Z" className="fill-accent" clipPath="url(#ds)" />
      <rect x="30" y="93" width="140" height="3" className="fill-lavender" />
      <path d="M68 122 Q76 112 84 122" className="stroke-lavender" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path
        d="M116 122 Q124 112 132 122"
        className="stroke-lavender"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M84 138 Q100 148 116 138"
        className="stroke-lavender"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function App() {
  const [isAlive, setIsAlive] = useState(false);
  const [_isRecording, setIsRecording] = useState(false);
  const [view, setView] = useState<View>({ name: 'library' });
  const [search, setSearch] = useState('');
  const [activeUrl, setActiveUrl] = useState<string>();
  const [voice, setVoice] = useState<PanelVoiceUpdate>({ type: 'VOICE_UPDATE', phase: 'idle' });
  const [voiceStarted, setVoiceStarted] = useState(false);

  useEffect(() => {
    const disconnect = connectToBackground({
      onConnect: () => {
        setIsAlive(true);
        if (import.meta.env.BROWSER === 'firefox') return;
        getVoiceStatus()
          .then((status) => {
            if (!status?.transcribing) return;
            setVoiceStarted(true);
            setVoice({ type: 'VOICE_UPDATE', phase: 'transcribing' });
          })
          .catch(() => undefined);
      },
      onDisconnect: () => setIsAlive(false),
      onStateUpdate: (update) => {
        if (update.state === CaptureState.RECORDING) {
          setIsRecording(true);
          const guideId = update.currentGuideId;
          if (guideId) {
            setView((prev) => (prev.name === 'recording' ? prev : { name: 'recording', guideId }));
          }
        } else {
          setIsRecording(false);
        }
      },
      onVoiceUpdate: (update) => {
        if (update.phase !== 'idle') setVoiceStarted(true);
        setVoice(update);
      },
    });

    return disconnect;
  }, []);

  useEffect(() => {
    browser.storage.local.get([SESSION_KEY]).then((data: Record<string, unknown>) => {
      const session = data[SESSION_KEY] as GuideMeSession | null;
      if (session?.active) {
        setView({ name: 'guideme', guideId: session.guideId });
      }
    });

    const handler = (changes: Record<string, { newValue?: unknown }>) => {
      if (!changes[SESSION_KEY]) return;
      const session = changes[SESSION_KEY].newValue as GuideMeSession | null;
      if (session?.active) {
        setView({ name: 'guideme', guideId: session.guideId });
      }
    };

    browser.storage.local.onChanged.addListener(handler);
    return () => browser.storage.local.onChanged.removeListener(handler);
  }, []);

  useEffect(() => {
    const refresh = () => getActiveTab().then((tab) => setActiveUrl(tab?.url || tab?.pendingUrl || ''));
    refresh();
    browser.tabs.onActivated.addListener(refresh);
    browser.tabs.onUpdated.addListener(refresh);
    return () => {
      browser.tabs.onActivated.removeListener(refresh);
      browser.tabs.onUpdated.removeListener(refresh);
    };
  }, []);

  const handleStartRecording = useCallback(async () => {
    const permissionsPromise = requestHostPermissions();
    const granted = await permissionsPromise;
    if (!granted) {
      logger.warn('Host permissions not granted, cannot start recording');
      return;
    }
    const tab = await getActiveTab();
    const url = tab?.url || tab?.pendingUrl || '';
    if (!isRecordableUrl(url)) {
      logger.warn('Active tab can no longer be recorded');
      return;
    }

    try {
      const res = await sendMessage('startRecording', { url });
      if (res.guideId) {
        setIsRecording(true);
        setView({ name: 'recording', guideId: res.guideId });
      }
    } catch (err) {
      logger.error(' START_RECORDING error', err);
    }
  }, []);

  const handleStopRecording = useCallback(async () => {
    try {
      const res = await sendMessage('stopRecording', undefined);
      if (res.success) {
        setIsRecording(false);
        setView(res.inserted && res.guideId ? { name: 'editor', guideId: res.guideId } : { name: 'library' });
        if (res.guideId) {
          const url = getExtensionURL(`/fullview.html?guideId=${res.guideId}`);
          const tabs = await queryTabs({ url: getExtensionURL('/fullview.html') });
          if (tabs.length > 0 && tabs[0].id) {
            await updateTab(tabs[0].id, { active: true, url });
            if (tabs[0].windowId) await focusWindow(tabs[0].windowId);
          } else {
            await createTab({ url });
          }
        }
      }
    } catch (err) {
      logger.error(' STOP_RECORDING error', err);
    }
  }, []);

  function renderView() {
    if (view.name === 'recording') {
      return <RecordingView guideId={view.guideId} onStop={handleStopRecording} voice={voice} />;
    }

    if (view.name === 'guideme') {
      return (
        <GuideMeView
          guideId={view.guideId}
          onExit={() => {
            sendMessage('guideMeCancel', undefined).catch(() => {});
            setView({ name: 'library' });
          }}
          onComplete={(id) => setView({ name: 'guideme-done', guideId: id })}
        />
      );
    }

    if (view.name === 'guideme-done') {
      return (
        <GuideMeCompletion
          guideId={view.guideId}
          onDone={() => setView({ name: 'library' })}
          onRunAgain={async (id) => {
            await sendMessage('startGuideMe', { guideId: id });
            setView({ name: 'guideme', guideId: id });
          }}
        />
      );
    }

    if (view.name === 'editor') {
      return (
        <GuideEditor
          guideId={view.guideId}
          onBack={() => setView({ name: 'library' })}
          onGuideMe={(id) => setView({ name: 'guideme', guideId: id })}
        />
      );
    }

    if (view.name === 'settings') {
      return <SettingsView onBack={() => setView({ name: 'library' })} />;
    }

    return (
      <div className="min-h-screen bg-card flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-7 border-b border-border">
          <div className="flex items-center justify-between mb-5">
            <span className="text-[17px] font-bold tracking-tight text-foreground">{i18n.t('app.name')}</span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${isAlive ? 'bg-success' : 'bg-muted-foreground/40'}`}
                  aria-hidden="true"
                />
                {isAlive ? i18n.t('sidepanel.connected') : i18n.t('sidepanel.connecting')}
              </span>
              <button
                onClick={() => setView({ name: 'settings' })}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-accent hover:bg-secondary transition-colors"
              >
                <Settings size={15} />
              </button>
            </div>
          </div>

          <div className="text-center mb-5">
            <div className="flex justify-center mb-2">
              <MascotIcon size={44} />
            </div>
            <h3 className="text-base font-medium text-foreground">{i18n.t('sidepanel.heroTitle')}</h3>
            <p className="text-xs mt-1 text-muted-foreground">{i18n.t('sidepanel.heroSubtitle')}</p>
          </div>

          {isRecordableUrl(activeUrl) ? (
            <Button
              onClick={handleStartRecording}
              disabled={!isAlive}
              className="w-full py-3 px-4 h-auto rounded-lg font-semibold text-sm hover:-translate-y-px shadow-sm"
            >
              <Video size={18} />
              {i18n.t('sidepanel.startCapture')}
            </Button>
          ) : (
            <p className="flex items-center justify-center gap-1.5 rounded-lg border border-border py-2.5 text-xs font-medium text-muted-foreground">
              <Globe size={14} className="shrink-0 text-accent" />
              {i18n.t('sidepanel.notRecordable')}
            </p>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 px-5 pt-5">
          <UpdateNotice className="mb-4" />

          <div className="relative mb-5">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple" />
            <Input
              type="text"
              placeholder={i18n.t('sidepanel.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 rounded-xl border-border bg-card !text-[13px]"
            />
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-wider mb-2.5 text-muted-foreground">
            {i18n.t('sidepanel.recentLabel')}
          </p>

          <LibraryView
            onOpen={(guideId) => setView({ name: 'editor', guideId })}
            isAlive={isAlive}
            searchQuery={search}
          />
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      {renderView()}
      {import.meta.env.BROWSER !== 'firefox' && view.name !== 'recording' && (
        <VoiceToast update={voice} confirmable={voiceStarted} onOpenSettings={() => setView({ name: 'settings' })} />
      )}
    </TooltipProvider>
  );
}
