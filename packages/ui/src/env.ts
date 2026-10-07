export interface RecordableTab {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
}

interface TabLike {
  id?: number;
  url?: string;
  title?: string;
  windowId?: number;
  pendingUrl?: string;
}

export interface UiEnv {
  tabs: {
    create(url: string): Promise<TabLike | null>;
    recordable(): Promise<RecordableTab[]>;
    startInsertRecording(guideId: string, index: number, tabId: number): Promise<void>;
  };
  panel: {
    open(): void;
  };
  send<T = any>(name: string, payload?: unknown): Promise<T>;
  appIconUrl?(id: string): string | null;
}

let current: UiEnv | null = null;

export function configureUi(env: UiEnv): void {
  current = env;
}

function env(): UiEnv {
  if (!current) throw new Error('@mimik/ui is not configured — call configureUi() at the surface entry point');
  return current;
}

export const tabs: UiEnv['tabs'] = {
  create: (url) => env().tabs.create(url),
  recordable: () => env().tabs.recordable(),
  startInsertRecording: (guideId, index, tabId) => env().tabs.startInsertRecording(guideId, index, tabId),
};

export const panel: UiEnv['panel'] = {
  open: () => env().panel.open(),
};

export const appIcons = {
  url: (id: string): string | null => current?.appIconUrl?.(id) ?? null,
};

export const messages: Pick<UiEnv, 'send'> = {
  send: (name, payload) => env().send(name, payload),
};
