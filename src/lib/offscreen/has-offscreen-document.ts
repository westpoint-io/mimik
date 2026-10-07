const OFFSCREEN_CONTEXT = 'OFFSCREEN_DOCUMENT';

interface ContextsApi {
  getContexts(filter: { contextTypes: string[] }): Promise<unknown[]>;
}

function contextsApi(): ContextsApi | undefined {
  const runtime = (globalThis as { chrome?: { runtime?: Partial<ContextsApi> } }).chrome?.runtime;
  return typeof runtime?.getContexts === 'function' ? (runtime as ContextsApi) : undefined;
}

export async function hasOffscreenDocument(): Promise<boolean> {
  const api = contextsApi();
  if (!api) return false;
  try {
    const contexts = await api.getContexts({ contextTypes: [OFFSCREEN_CONTEXT] });
    return contexts.length > 0;
  } catch {
    return false;
  }
}
