interface OffscreenApi {
  createDocument(options: { url: string; reasons: string[]; justification: string }): Promise<void>;
  closeDocument(): Promise<void>;
}

export function offscreenApi(): OffscreenApi | undefined {
  return (globalThis as { chrome?: { offscreen?: OffscreenApi } }).chrome?.offscreen;
}
