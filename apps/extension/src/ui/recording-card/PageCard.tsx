import type { CardCommand } from '@mimik/core/capture/card-view';
import { isLive } from '@mimik/core/capture/is-live';
import { CaptureState } from '@mimik/core/capture/machine';
import { logger } from '@mimik/core/logger';
import { RecordingCard, RecordingIconButton } from '@mimik/ui';
import { EyeOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { browser, i18n } from '#imports';
import { isRecordableUrl } from '@/capture/recordable-tabs';
import { getActiveTab } from '@/lib/browser-api/get-active-tab';
import { localStorage } from '@/lib/browser-api/local-storage';
import { requestHostPermissions } from '@/lib/browser-api/request-host-permissions';
import { sessionStorage } from '@/lib/browser-api/session-storage';
import { sendMessage } from '@/lib/messaging';
import { MicToggle } from '@/ui/sidepanel/MicToggle';
import { closeCard } from './lib/close-card';
import { postToPage } from './lib/post-to-page';
import { startCardDrag } from './lib/start-card-drag';
import { useCardView } from './use-card-view';

const PARAMS = new URLSearchParams(location.search);
const POPUP = PARAMS.has('popup');
const BLOCKED = POPUP || PARAMS.has('blocked');

export function PageCard() {
  const live = useCardView();
  const [starting, setStarting] = useState(false);
  const wasLive = useRef(false);
  const view = live && (isLive(live.state) ? live : { ...live, state: CaptureState.ARMED, step: null, starting });
  const [collapsed, setCollapsed] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const paused = view?.state === CaptureState.PAUSED;

  useEffect(() => {
    void sessionStorage.get('cardCollapsed').then((stored) => setCollapsed(stored.cardCollapsed === true));
    void localStorage.get(['voiceEnabled']).then((stored) => setVoiceEnabled(stored.voiceEnabled === true));
  }, []);

  useEffect(() => {
    const onChange = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && changes.recordingCard && changes.recordingCard.newValue !== true) closeCard();
    };
    browser.storage.onChanged.addListener(onChange);
    return () => browser.storage.onChanged.removeListener(onChange);
  }, []);

  useEffect(() => {
    if (!live) return;
    if (isLive(live.state)) wasLive.current = true;
    else if (wasLive.current) closeCard();
  }, [live]);

  const run = async (command: CardCommand) => {
    if (command === 'start') {
      if (!(await requestHostPermissions())) return;
      const tab = await getActiveTab();
      const url = tab?.url || tab?.pendingUrl || '';
      if (!isRecordableUrl(url)) return;
      setStarting(true);
      await sendMessage('startRecording', { url }).finally(() => setStarting(false));
    } else if (command === 'disarm') {
      closeCard();
    } else if (command === 'stop') {
      await sendMessage('stopRecording', { openGuide: true });
    } else if (command === 'pause') {
      await sendMessage('pauseCapture', undefined);
    } else if (command === 'resume') {
      await sendMessage(view?.pauseReason === 'blur' ? 'exitBlurMode' : 'resumeCapture', undefined);
    } else if (command === 'discard') {
      await sendMessage('discardRecording', undefined);
    } else if (command === 'deleteStep' && view?.step) {
      await sendMessage('removeStep', view.step.id);
    }
  };

  return (
    <RecordingCard
      view={view}
      onCommand={(command) => void run(command).catch((error) => logger.error('card: command failed', command, error))}
      mic={
        import.meta.env.BROWSER !== 'firefox' && (
          <MicToggle
            enabled={voiceEnabled}
            live={view?.narration !== null}
            paused={paused}
            onChange={setVoiceEnabled}
          />
        )
      }
      tools={
        <RecordingIconButton
          label={i18n.t('recording.smartBlur')}
          disabled={paused}
          onClick={() => void sendMessage('enterBlurMode', undefined)}
        >
          <EyeOff />
        </RecordingIconButton>
      }
      collapsed={collapsed}
      onCollapsedChange={(next) => {
        setCollapsed(next);
        void sessionStorage.set({ cardCollapsed: next });
      }}
      blocked={BLOCKED ? i18n.t('sidepanel.notRecordable') : undefined}
      onGrab={POPUP ? undefined : startCardDrag}
      onLayout={() =>
        postToPage({ mimikCard: 'size', width: document.body.scrollWidth, height: document.body.scrollHeight })
      }
    />
  );
}
