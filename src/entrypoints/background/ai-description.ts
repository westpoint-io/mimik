import { getAIDescription } from '@/core/capture/ai/description';
import { resolveAIConfig } from '@/core/capture/ai/resolve';
import type { DOMContext } from '@/core/capture/dom/context';
import { localStorage } from '@/lib/browser-api';

export async function generateAiDescription(domContext: DOMContext): Promise<string | undefined> {
  const settings = await localStorage.get([
    'aiApiKey',
    'aiProvider',
    'aiModel',
    'aiBaseUrl',
    'aiEndpoint',
    'aiProfiles',
  ]);
  const cfg = resolveAIConfig(settings);
  if (!cfg) return undefined;
  const hasKey = cfg.apiKey.trim().length > 0;
  const isLocal = cfg.baseUrl
    ? cfg.baseUrl.toLowerCase().includes('localhost') ||
      cfg.baseUrl.includes('127.0.0.1') ||
      cfg.baseUrl.startsWith('http://')
    : false;
  if (!hasKey && !isLocal) return undefined;

  const description = await getAIDescription(domContext, cfg.providerSdk, cfg.model, cfg.apiKey, cfg.baseUrl);
  return description || undefined;
}
