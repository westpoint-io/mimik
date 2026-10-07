import type { ReactNode } from 'react';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-3 text-sm text-foreground">
      <span className="mr-auto">{label}</span>
      {children}
    </label>
  );
}
