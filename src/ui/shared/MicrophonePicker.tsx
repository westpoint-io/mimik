import { Check, ChevronRight, Mic, MicOff, Square, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { i18n } from '#imports';
import { getActiveTab } from '@/lib/browser-api';
import { openMicPermissionPage } from '@/lib/offscreen';
import { Button } from '@/ui/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/ui/select';
import {
  isMicrophoneMissing,
  type MicrophoneDevice,
  type MicrophonePermission,
  type MicrophoneStatus,
  microphoneListState,
  microphoneStatus,
  nextMicLevel,
  SPEAKING_LEVEL,
  SYSTEM_DEFAULT_VALUE,
  toMicrophoneOptions,
  toSelectValue,
  toStoredMicrophoneId,
} from './microphones';

interface MicrophonePickerProps {
  triggerClassName?: string;
  value: string;
  onChange: (deviceId: string) => void;
}

interface MicTest {
  stream: MediaStream;
  context: AudioContext;
  timer: number;
}

const MICROPHONE: PermissionDescriptor = { name: 'microphone' as PermissionName };
const ANALYSER_FFT_SIZE = 2048;
const METER_INTERVAL_MS = 80;

const STATUS_STYLES: Record<MicrophoneStatus, string> = {
  allowed: 'bg-success/10 text-success',
  blocked: 'bg-destructive/10 text-destructive',
  pending: 'bg-secondary text-muted-foreground',
};

const STATUS_LABELS: Record<MicrophoneStatus, string> = {
  allowed: 'settings.microphoneStatusAllowed',
  blocked: 'settings.microphoneStatusBlocked',
  pending: 'settings.microphoneStatusPending',
};

function StatusBadge({ status }: { status: MicrophoneStatus }) {
  const Icon = status === 'allowed' ? Check : status === 'blocked' ? MicOff : Mic;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${STATUS_STYLES[status]}`}
    >
      <Icon size={9} />
      {i18n.t(STATUS_LABELS[status])}
    </span>
  );
}

export default function MicrophonePicker({ value, onChange, triggerClassName }: MicrophonePickerProps) {
  const [devices, setDevices] = useState<MicrophoneDevice[]>([]);
  const [testing, setTesting] = useState(false);
  const [level, setLevel] = useState(0);
  const [testFailed, setTestFailed] = useState(false);
  const [permission, setPermission] = useState<MicrophonePermission>('unknown');
  const test = useRef<MicTest | null>(null);
  const triggerId = useId();

  const refresh = useCallback(async () => {
    const media = navigator.mediaDevices;
    if (!media?.enumerateDevices) return;
    setDevices(await media.enumerateDevices().catch(() => [] as MediaDeviceInfo[]));
  }, []);

  const stopTest = useCallback(() => {
    const running = test.current;
    test.current = null;
    setTesting(false);
    setLevel(0);
    if (!running) return;
    window.clearInterval(running.timer);
    for (const track of running.stream.getTracks()) track.stop();
    void running.context.close().catch(() => undefined);
  }, []);

  useEffect(() => {
    void refresh();
    const media = navigator.mediaDevices;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    media?.addEventListener('devicechange', refresh);
    document.addEventListener('visibilitychange', onVisible);

    let status: PermissionStatus | undefined;
    const onPermission = () => {
      setPermission(status?.state ?? 'unknown');
      void refresh();
    };
    navigator.permissions
      ?.query(MICROPHONE)
      .then((result) => {
        status = result;
        setPermission(result.state);
        result.addEventListener('change', onPermission);
      })
      .catch(() => undefined);

    return () => {
      media?.removeEventListener('devicechange', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      status?.removeEventListener('change', onPermission);
    };
  }, [refresh]);

  useEffect(() => stopTest, [stopTest]);

  const requestAccess = useCallback(async () => {
    const tab = await getActiveTab().catch(() => undefined);
    await openMicPermissionPage(tab?.id).catch(() => undefined);
    await refresh();
  }, [refresh]);

  const startTest = useCallback(async () => {
    stopTest();
    setTestFailed(false);
    const deviceId = value.trim();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      });
      const context = new AudioContext();
      if (context.state === 'suspended') await context.resume();
      const analyser = context.createAnalyser();
      analyser.fftSize = ANALYSER_FFT_SIZE;
      const mute = context.createGain();
      mute.gain.value = 0;
      context.createMediaStreamSource(stream).connect(analyser);
      analyser.connect(mute);
      mute.connect(context.destination);

      const frame = new Float32Array(analyser.fftSize);
      let current = 0;
      const timer = window.setInterval(() => {
        analyser.getFloatTimeDomainData(frame);
        let sum = 0;
        for (const sample of frame) sum += sample * sample;
        current = nextMicLevel(Math.sqrt(sum / frame.length), current);
        setLevel(current);
      }, METER_INTERVAL_MS);

      test.current = { stream, context, timer };
      setTesting(true);
    } catch {
      setTestFailed(true);
    }
  }, [stopTest, value]);

  const state = microphoneListState(devices);
  const options = toMicrophoneOptions(devices);
  const missing = isMicrophoneMissing(value, options);
  const status = microphoneStatus(permission, state);
  const blocked = status === 'blocked';

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <label
          htmlFor={state === 'ready' ? triggerId : undefined}
          className="text-[11px] font-semibold text-foreground"
        >
          {i18n.t('settings.microphone')}
        </label>
        <StatusBadge status={status} />
      </div>

      {state === 'no-devices' && !blocked && (
        <p className="text-[10px] text-muted-foreground leading-relaxed">{i18n.t('settings.microphoneNone')}</p>
      )}

      {(state === 'unlabelled' || blocked) && (
        <div className="space-y-2">
          {!blocked && (
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              {i18n.t('settings.microphoneNeedsAccess')}
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void requestAccess()}
            className="w-full rounded-lg bg-card text-[11px] font-semibold"
          >
            <Mic size={12} />
            {i18n.t(blocked ? 'micPermission.retry' : 'settings.microphoneGrantAccess')}
          </Button>
          {blocked && (
            <details className="group">
              <summary className="flex items-center gap-1 text-[10px] font-semibold text-accent cursor-pointer list-none">
                <ChevronRight size={10} className="transition-transform group-open:rotate-90" />
                {i18n.t('settings.microphoneUnblockHow')}
              </summary>
              <p className="mt-1.5 text-[10px] text-muted-foreground leading-relaxed">
                {i18n.t('settings.microphoneBlocked')}
              </p>
            </details>
          )}
        </div>
      )}

      {state === 'ready' && !blocked && (
        <div className="space-y-2">
          <Select
            value={toSelectValue(value)}
            onValueChange={(next) => {
              stopTest();
              onChange(toStoredMicrophoneId(next));
            }}
          >
            <SelectTrigger id={triggerId} aria-label={i18n.t('settings.microphone')} className={triggerClassName}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SYSTEM_DEFAULT_VALUE}>{i18n.t('settings.microphoneDefault')}</SelectItem>
              {options.map((option) => (
                <SelectItem key={option.deviceId} value={option.deviceId}>
                  {option.label}
                </SelectItem>
              ))}
              {missing && (
                <SelectItem value={toSelectValue(value)}>{i18n.t('settings.microphoneUnavailable')}</SelectItem>
              )}
            </SelectContent>
          </Select>

          {missing && (
            <p className="flex items-start gap-1.5 text-[10px] text-destructive leading-relaxed">
              <TriangleAlert size={11} className="shrink-0 mt-0.5" />
              <span>{i18n.t('settings.microphoneMissing')}</span>
            </p>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => (testing ? stopTest() : void startTest())}
            className="w-full rounded-lg bg-card text-[11px] font-semibold"
          >
            {testing ? <Square size={11} /> : <Mic size={11} />}
            {i18n.t(testing ? 'settings.microphoneTestStop' : 'settings.microphoneTest')}
          </Button>

          {testing && (
            <div className="space-y-1">
              <div aria-hidden="true" className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-100 motion-reduce:transition-none"
                  style={{ width: `${Math.round(level * 100)}%` }}
                />
              </div>
              <p aria-live="polite" className="text-[10px] text-muted-foreground">
                {i18n.t(level > SPEAKING_LEVEL ? 'voice.micHearing' : 'voice.micQuiet')}
              </p>
            </div>
          )}

          {testFailed && (
            <p className="text-[10px] text-destructive leading-relaxed">{i18n.t('settings.microphoneTestFailed')}</p>
          )}
        </div>
      )}
    </div>
  );
}
