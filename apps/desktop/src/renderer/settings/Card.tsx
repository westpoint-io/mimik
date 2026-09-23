import type { Command } from 'lucide-react';
import type { ReactNode } from 'react';

export function Card({ icon: Icon, title, children }: { icon: typeof Command; title: string; children: ReactNode }) {
  return (
    <div className="space-y-3.5 rounded-[10px] border border-border bg-card p-3.5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary">
          <Icon size={14} className="text-accent" />
        </div>
        <span className="text-xs font-bold text-foreground">{title}</span>
      </div>
      {children}
    </div>
  );
}
