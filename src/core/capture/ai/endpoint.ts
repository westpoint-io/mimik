export function normalizeEndpoint(provider: string, raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return '';
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';

  if (provider === 'azure' && url.hostname.endsWith('.openai.azure.com') && !url.pathname.endsWith('/openai')) {
    return `${trimmed}/openai`;
  }

  return trimmed;
}

function isPrivateIPv4(hostname: string): boolean {
  const parts = hostname.split('.');
  if (parts.length !== 4) return false;
  const octets = parts.map(Number);
  if (octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  const [a, b] = octets;
  if (a === 127) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

export function isInsecureEndpoint(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  if (url.protocol !== 'http:') return false;

  const hostname = url.hostname;
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false;
  if (hostname === '[::1]') return false;
  if (hostname.endsWith('.local')) return false;
  if (isPrivateIPv4(hostname)) return false;

  return true;
}
