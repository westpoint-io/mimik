import type { ReactNode } from 'react';

interface RowProps {
  label: string;
  hint?: string;
  stack?: boolean;
  children: ReactNode;
}

export function Row({ label, hint, stack, children }: RowProps) {
  return (
    <div className={`flex gap-3 py-3 ${stack ? 'flex-col' : 'items-center justify-between gap-6'}`}>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {hint && <span className="text-xs leading-relaxed text-muted-foreground">{hint}</span>}
      </span>
      {children}
    </div>
  );
}
