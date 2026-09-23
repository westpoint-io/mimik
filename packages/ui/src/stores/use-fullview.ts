import { useShallow } from 'zustand/react/shallow';
import { type FullviewStore, useFullviewStore } from './fullview';

export function useFullview<T>(selector: (s: FullviewStore) => T): T {
  return useFullviewStore(useShallow(selector));
}
