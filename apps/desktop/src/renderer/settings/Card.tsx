import { SettingsCard } from '@mimik/ui';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface CardProps {
  icon: LucideIcon;
  title: string;
  hint?: string;
  children: ReactNode;
}

export function Card({ icon, title, hint, children }: CardProps) {
  return (
    <SettingsCard icon={icon} title={title} hint={hint} className="pb-1">
      <div className="-mt-2 divide-y divide-secondary">{children}</div>
    </SettingsCard>
  );
}
