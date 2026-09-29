interface MainReply {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  encoding: 'text' | 'base64';
}

export async function mainFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const headers: Record<string, string> = {};
  new Headers(init?.headers).forEach((value, key) => {
    headers[key] = value;
  });
  const signal = init?.signal ?? undefined;
  signal?.throwIfAborted();

  const id = crypto.randomUUID();
  let onAbort = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => {
      window.mimik.ai.abort(id);
      reject(signal?.reason);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

  try {
    const reply = (await Promise.race([
      window.mimik.ai.fetch({
        id,
        url,
        method: init?.method ?? 'GET',
        headers,
        body: typeof init?.body === 'string' ? init.body : undefined,
      }),
      aborted,
    ])) as MainReply;
    const body = reply.encoding === 'base64' ? Uint8Array.from(atob(reply.body), (c) => c.charCodeAt(0)) : reply.body;
    return new Response(body, { status: reply.status, statusText: reply.statusText, headers: reply.headers });
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}
