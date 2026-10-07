import type { Command } from 'lucide-react';
import type { ReactNode } from 'react';

interface CardProps {
  icon: typeof Command;
  title: string;
  hint?: string;
  children: ReactNode;
}

export function Card({ icon: Icon, title, hint, children }: CardProps) {
  return (
    <div className="rounded-[10px] border border-border bg-card px-3.5 pt-3.5 pb-1">
      <div className="flex items-center gap-2.5 pb-1">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary">
          <Icon size={14} className="text-accent" />
        </div>
        <span className="flex flex-col">
          <span className="text-xs font-bold text-foreground">{title}</span>
          {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
        </span>
      </div>
      <div className="divide-y divide-secondary">{children}</div>
    </div>
  );
}
