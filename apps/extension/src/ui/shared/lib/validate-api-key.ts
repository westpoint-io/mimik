import { sendMessage } from '@/lib/messaging';

export function validateApiKey(provider: string, apiKey: string, baseUrl?: string, model?: string) {
  return sendMessage('validateApiKey', { provider, apiKey, baseUrl, model });
}
