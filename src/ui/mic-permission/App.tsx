import { Check, Mic, MicOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { browser, i18n } from '#imports';
import { useDisplayLocale } from '@/lib/use-display-locale';
import {
  VOICE_BACKGROUND_TARGET,
  VoiceMessage,
  type VoicePermissionResultEvent,
  type VoicePermissionState,
  voiceMessage,
} from '@/lib/voice-messages';

type Phase = 'checking' | 'prompting' | 'granted' | 'denied';

const MICROPHONE: PermissionDescriptor = { name: 'microphone' as PermissionName };

async function queryState(): Promise<VoicePermissionState> {
  try {
    const status = await navigator.permissions.query(MICROPHONE);
    return status.state as VoicePermissionState;
  } catch {
    return 'unknown';
  }
}

async function requestMicrophone(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
    return true;
  } catch {
    return false;
  }
}

function report(state: 'granted' | 'denied'): void {
  const event = voiceMessage<VoicePermissionResultEvent>({
    type: VoiceMessage.VOICE_PERMISSION_RESULT,
    target: VOICE_BACKGROUND_TARGET,
    state,
  });
  browser.runtime.sendMessage(event).catch(() => undefined);
}

function openerTabId(): number | null {
  const raw = new URLSearchParams(window.location.search).get('tabId');
  const id = raw === null ? Number.NaN : Number(raw);
  return Number.isInteger(id) && id >= 0 ? id : null;
}

async function returnToOpener(): Promise<void> {
  const tabId = openerTabId();
  if (tabId !== null) await browser.tabs.update(tabId, { active: true }).catch(() => undefined);
  const self = await browser.tabs.getCurrent().catch(() => undefined);
  if (self?.id !== undefined) await browser.tabs.remove(self.id).catch(() => undefined);
  else window.close();
}

export default function MicPermissionApp() {
  useDisplayLocale();
  const [phase, setPhase] = useState<Phase>('checking');
  const settled = useRef(false);
  const reportedDenied = useRef(false);

  const deny = useCallback(() => {
    setPhase('denied');
    if (reportedDenied.current) return;
    reportedDenied.current = true;
    report('denied');
  }, []);

  const grant = useCallback(() => {
    settled.current = true;
    setPhase('granted');
    report('granted');
    void returnToOpener();
  }, []);

  const evaluate = useCallback(
    async (allowPrompt: boolean) => {
      if (settled.current) return;
      const state = await queryState();
      if (state === 'granted') {
        grant();
        return;
      }
      if (state === 'denied') {
        deny();
        return;
      }
      if (!allowPrompt) return;
      setPhase('prompting');
      if (await requestMicrophone()) grant();
      else deny();
    },
    [deny, grant],
  );

  useEffect(() => {
    void evaluate(true);
  }, [evaluate]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void evaluate(false);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [evaluate]);

  useEffect(() => {
    let status: PermissionStatus | undefined;
    const onChange = () => {
      void evaluate(false);
    };
    navigator.permissions
      .query(MICROPHONE)
      .then((result) => {
        status = result;
        result.addEventListener('change', onChange);
      })
      .catch(() => undefined);
    return () => status?.removeEventListener('change', onChange);
  }, [evaluate]);

  const denied = phase === 'denied';
  const granted = phase === 'granted';
  const Icon = denied ? MicOff : granted ? Check : Mic;

  return (
    <div className="min-h-screen bg-card text-foreground flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${
            denied ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-accent'
          }`}
        >
          <Icon size={28} strokeWidth={2} />
        </div>

        <h1 className="text-2xl font-extrabold leading-tight tracking-tight mb-2">
          {i18n.t(
            denied ? 'micPermission.deniedTitle' : granted ? 'micPermission.grantedTitle' : 'micPermission.title',
          )}
        </h1>

        <p className="text-sm text-muted-foreground leading-relaxed mb-8">
          {i18n.t(
            denied
              ? 'micPermission.deniedMessage'
              : granted
                ? 'micPermission.grantedMessage'
                : phase === 'checking'
                  ? 'micPermission.checkingMessage'
                  : 'micPermission.promptingMessage',
          )}
        </p>

        {denied && (
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => void evaluate(true)}
              className="px-7 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              {i18n.t('micPermission.retry')}
            </button>
            <button
              onClick={() => void returnToOpener()}
              className="px-6 py-3 text-muted-foreground rounded-xl font-semibold text-sm hover:text-foreground transition-colors"
            >
              {i18n.t('common.close')}
            </button>
          </div>
        )}

        <p className="text-xs text-muted-foreground/80 leading-relaxed mt-10 border-t border-border pt-6">
          {i18n.t('micPermission.privacy')}
        </p>
      </div>
    </div>
  );
}
