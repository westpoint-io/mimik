import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

interface SettingsCardProps {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function SettingsCard({ icon: Icon, title, hint, action, className, children }: SettingsCardProps) {
  return (
    <div className={cn('border border-border rounded-[10px] bg-card p-3.5 space-y-3', className)}>
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center shrink-0">
          <Icon size={14} className="text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-foreground">{title}</div>
          {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
