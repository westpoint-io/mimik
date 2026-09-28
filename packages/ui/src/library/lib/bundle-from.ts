import { BUNDLE_EXTENSION } from '@mimik/core/transfer/schema';

export function bundleFrom(list: FileList | null): File | null {
  const files = Array.from(list ?? []);
  if (files.length === 0) return null;
  return files.find((f) => f.name.toLowerCase().endsWith(`.${BUNDLE_EXTENSION}`)) ?? files[0];
}
