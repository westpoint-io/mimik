export type KeyStatus = 'checking' | 'valid' | 'rejected' | 'unreachable' | 'model-required' | 'model-invalid' | null;

export type KeyWarning = 'cannot-spend';

export interface KeyCheckResult {
  valid: boolean;
  reason?: 'rejected' | 'network' | 'model-required' | 'model-invalid';
  models?: string[];
  warning?: KeyWarning;
}

export type ValidateKey = (
  provider: string,
  apiKey: string,
  baseUrl?: string,
  model?: string,
) => Promise<KeyCheckResult | null>;
