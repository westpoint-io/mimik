import type { CheckResult } from './types';

export function report(results: CheckResult[]): void {
  console.log(`MIMIK_STORAGE_CHECK ${JSON.stringify(results)}`);
}
