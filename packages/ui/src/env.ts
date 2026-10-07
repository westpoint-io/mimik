export type GuideDescriptionError = 'no-api-key' | 'no-steps' | 'generation-failed' | 'save-failed';

export interface RecordableTab {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
}

export interface TabLike {
  id?: number;
  url?: string;
  title?: string;
  windowId?: number;
  pendingUrl?: string;
}

export interface UiEnv {
  tabs: {
    active(): Promise<TabLike | null>;
    get(tabId: number): Promise<TabLike | null>;
    query(query?: Record<string, unknown>): Promise<TabLike[]>;
    create(url: string): Promise<TabLike | null>;
    update(tabId: number, props: Record<string, unknown>): Promise<TabLike | null>;
    focusWindow(windowId: number): Promise<void>;
    recordable(): Promise<RecordableTab[]>;
    startInsertRecording(guideId: string, index: number, tabId: number): Promise<void>;
  };
  panel: {
    open(): void;
    requestHostPermissions(): Promise<boolean>;
  };
  send<T = any>(name: string, payload?: unknown): Promise<T>;
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
  active: () => env().tabs.active(),
  get: (tabId) => env().tabs.get(tabId),
  query: (query) => env().tabs.query(query),
  create: (url) => env().tabs.create(url),
  update: (tabId, props) => env().tabs.update(tabId, props),
  focusWindow: (windowId) => env().tabs.focusWindow(windowId),
  recordable: () => env().tabs.recordable(),
  startInsertRecording: (guideId, index, tabId) => env().tabs.startInsertRecording(guideId, index, tabId),
};

export const panel: UiEnv['panel'] = {
  open: () => env().panel.open(),
  requestHostPermissions: () => env().panel.requestHostPermissions(),
};

export const messages: Pick<UiEnv, 'send'> = {
  send: (name, payload) => env().send(name, payload),
};
