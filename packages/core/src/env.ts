import type { Settings, SettingsKey } from './guides/types';

export type ClientType = 'extension' | 'desktop';

export interface CoreEnv {
  client: ClientType;
  t: (key: string, substitutions?: string[]) => string;
  assetUrl: (path: string) => string;
  storage: {
    get<K extends SettingsKey>(keys: readonly K[]): Promise<Partial<Pick<Settings, K>>>;
    set(items: Partial<Settings>): Promise<void>;
  };
}

let current: CoreEnv | null = null;

export function configureCore(env: CoreEnv): void {
  current = env;
}

function env(): CoreEnv {
  if (!current) {
    throw new Error('@mimik/core is not configured — call configureCore() at the surface entry point');
  }
  return current;
}

export const i18n = {
  t: (key: string, substitutions?: string[]) => env().t(key, substitutions),
};

export const assetUrl = (path: string) => env().assetUrl(path);

export const client = (): ClientType => env().client;

export const localStorage = {
  get: <K extends SettingsKey>(keys: readonly K[]) => env().storage.get(keys),
  set: (items: Partial<Settings>) => env().storage.set(items),
};
