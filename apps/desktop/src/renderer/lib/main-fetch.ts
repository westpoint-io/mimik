interface MainReply {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  encoding: 'text' | 'base64';
}

export async function mainFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const raw = init?.body;
  const encoded = raw == null || typeof raw === 'string' ? null : new Request(url, { method: 'POST', body: raw });
  const headers: Record<string, string> = {};
  new Headers(init?.headers).forEach((value, key) => {
    headers[key] = value;
  });
  const type = encoded?.headers.get('content-type');
  if (type && !headers['content-type']) headers['content-type'] = type;
  const payload = encoded ? new Uint8Array(await encoded.arrayBuffer()) : typeof raw === 'string' ? raw : undefined;
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
        body: payload,
      }),
      aborted,
    ])) as MainReply;
    const body = reply.encoding === 'base64' ? Uint8Array.from(atob(reply.body), (c) => c.charCodeAt(0)) : reply.body;
    return new Response(body, { status: reply.status, statusText: reply.statusText, headers: reply.headers });
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}
