import { ipcMain, net } from 'electron';

export interface AiRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface AiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}

const ALLOWED = new Set(['http:', 'https:']);

export function allowedEndpoint(url: string): boolean {
  try {
    return ALLOWED.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

export function registerAiFetch(): void {
  ipcMain.handle('mimik:ai:fetch', async (_event, request: AiRequest): Promise<AiResponse> => {
    if (!allowedEndpoint(request.url)) throw new Error('unsupported url');
    const response = await net.fetch(request.url, {
      method: request.method ?? 'GET',
      headers: request.headers,
      body: request.body,
    });
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return {
      status: response.status,
      statusText: response.statusText,
      headers,
      body: await response.text(),
    };
  });
}
