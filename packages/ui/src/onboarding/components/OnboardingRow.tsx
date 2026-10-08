import type { ReactNode } from 'react';

interface OnboardingRowProps {
  picture: ReactNode;
  title: string;
  hint: string;
  control?: ReactNode;
  children?: ReactNode;
}

export function OnboardingRow({ picture, title, hint, control, children }: OnboardingRowProps) {
  return (
    <div className="flex items-center gap-4 border-t border-secondary py-3.5 text-left first:border-t-0 first:pt-1 max-[640px]:flex-wrap">
      <div className="relative h-[88px] w-[132px] shrink-0 overflow-hidden rounded-[10px] bg-gradient-to-b from-lavender/50 to-secondary max-[640px]:w-full">
        {picture}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{hint}</p>
        {children}
      </div>
      {control}
    </div>
  );
}
