import {
  AI_CREDENTIAL_SETTINGS,
  type AiServer,
  type ApiKeys,
  aiChoice,
  type KeyName,
  readApiKeys,
  resolveServer,
  SERVER,
  withKey,
} from '@mimik/core/capture/ai/keys';
import { localStorage } from '@mimik/core/env';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface ApiKeysState {
  loaded: boolean;
  keys: ApiKeys;
  server: AiServer;
  setKey: (name: KeyName, value: string) => void;
  setServer: (patch: Partial<AiServer>) => void;
}

const NO_SERVER: AiServer = { url: '', protocol: 'openai', apiKey: '' };

interface Options {
  onChange?: (patch: Record<string, unknown>) => void;
  reloadOnFocus?: boolean;
}

export function useApiKeys({ onChange, reloadOnFocus = false }: Options = {}): ApiKeysState {
  const [loaded, setLoaded] = useState(false);
  const [keys, setKeys] = useState<ApiKeys>({});
  const [server, setServerState] = useState<AiServer>(NO_SERVER);
  const latest = useRef({ keys, server });
  latest.current = { keys, server };

  useEffect(() => {
    const load = () =>
      localStorage.get(AI_CREDENTIAL_SETTINGS).then((stored) => {
        const server = resolveServer(stored);
        const loaded = server ? withKey(readApiKeys(stored), SERVER, server.apiKey) : readApiKeys(stored);
        setKeys(loaded);
        setServerState(server ?? { ...NO_SERVER, apiKey: loaded.server ?? '' });
        setLoaded(true);
        if (server && !stored.aiServerUrl) {
          void localStorage.set({
            aiServerUrl: server.url,
            aiServerProtocol: server.protocol,
            aiBaseUrl: '',
            apiKeys: loaded,
            ...(aiChoice(stored) === SERVER ? { aiProvider: SERVER } : {}),
          });
        }
      });

    void load();
    if (!reloadOnFocus) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reloadOnFocus]);

  const save = useCallback(
    (patch: Record<string, unknown>) => {
      void localStorage.set(patch);
      onChange?.(patch);
    },
    [onChange],
  );

  const setKey = useCallback(
    (name: KeyName, value: string) => {
      const next = withKey(latest.current.keys, name, value);
      setKeys(next);
      save({ apiKeys: next });
    },
    [save],
  );

  const setServer = useCallback(
    (patch: Partial<AiServer>) => {
      const next = { ...latest.current.server, ...patch };
      const nextKeys = withKey(latest.current.keys, SERVER, next.apiKey);
      setServerState(next);
      setKeys(nextKeys);
      save({ aiServerUrl: next.url.trim(), aiServerProtocol: next.protocol, aiBaseUrl: '', apiKeys: nextKeys });
    },
    [save],
  );

  return { loaded, keys, server, setKey, setServer };
}
