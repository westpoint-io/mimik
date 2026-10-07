export const API_KEYS_ID = 'settings-api-keys';

export function openApiKeys() {
  document.getElementById(API_KEYS_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
