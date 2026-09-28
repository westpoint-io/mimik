import { ipcMain, type WebContents } from 'electron';

let seq = 0;

export function ask<T>(target: WebContents | null, channel: string, payload?: unknown, timeoutMs = 15_000): Promise<T> {
  if (!target || target.isDestroyed()) return Promise.reject(new Error(`${channel}: no renderer available`));

  const replyChannel = `${channel}:reply:${++seq}`;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      ipcMain.removeAllListeners(replyChannel);
      reject(new Error(`${channel}: renderer did not reply within ${timeoutMs}ms`));
    }, timeoutMs);

    ipcMain.once(replyChannel, (_event, result: unknown) => {
      clearTimeout(timer);
      const failure = result && typeof result === 'object' && 'error' in result ? result.error : undefined;
      if (typeof failure === 'string') reject(new Error(`${channel}: ${failure}`));
      else resolve(result as T);
    });

    target.send(channel, replyChannel, payload);
  });
}
