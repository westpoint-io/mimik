import { localStorage } from '@mimik/core/env';
import { resolveVoiceoverConfig, VOICEOVER_SETTINGS } from '@mimik/core/export/voiceover/config';
import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceSampleStatus =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'playing' }
  | { state: 'failed'; detail: string; suspectVoice: boolean }
  | { state: 'unreadable' };

interface SampleRun {
  abort: AbortController;
  context?: AudioContext;
}

export function useVoiceSample(settingsKey: string) {
  const [status, setStatus] = useState<VoiceSampleStatus & { key: string }>({ key: settingsKey, state: 'idle' });
  const current = useRef<SampleRun | null>(null);

  const stop = useCallback(() => {
    const run = current.current;
    current.current = null;
    run?.abort.abort();
    void run?.context?.close().catch(() => undefined);
    setStatus((previous) => ({ key: previous.key, state: 'idle' }));
  }, []);

  useEffect(() => stop, [stop]);

  const test = useCallback(
    async (text: string) => {
      stop();
      const run: SampleRun = { abort: new AbortController() };
      current.current = run;
      const key = settingsKey;
      setStatus({ key, state: 'loading' });

      try {
        const [{ sampleVoiceover }, stored] = await Promise.all([
          import('@mimik/core/export/voiceover/sample'),
          localStorage.get(VOICEOVER_SETTINGS),
        ]);
        const sample = await sampleVoiceover(resolveVoiceoverConfig(stored), text, run.abort.signal);
        if (current.current !== run) return;
        if (!sample.ok) {
          current.current = null;
          setStatus(
            sample.reason === 'failed'
              ? { key, state: 'failed', detail: sample.detail, suspectVoice: sample.suspectVoice }
              : { key, state: 'unreadable' },
          );
          return;
        }

        const context = new AudioContext();
        run.context = context;
        const source = context.createBufferSource();
        source.buffer = sample.buffer;
        source.connect(context.destination);
        source.onended = () => {
          if (current.current === run) stop();
        };
        source.start();
        setStatus({ key, state: 'playing' });
      } catch (error) {
        if (current.current !== run) return;
        current.current = null;
        setStatus({
          key,
          state: 'failed',
          detail: error instanceof Error ? error.message : String(error),
          suspectVoice: false,
        });
      }
    },
    [settingsKey, stop],
  );

  const shown: VoiceSampleStatus = status.key === settingsKey ? status : { state: 'idle' };
  return { status: shown, test, stop };
}
