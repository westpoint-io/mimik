import type { ReactNode } from 'react';

interface OnboardingCardProps {
  title: string;
  message?: string;
  children: ReactNode;
  className?: string;
}

export function OnboardingCard({ title, message, children, className = '' }: OnboardingCardProps) {
  return (
    <section
      className={`flex flex-col items-center gap-4 rounded-[18px] border border-lavender/60 bg-card px-7 py-6 text-center max-[640px]:px-4 ${className}`}
    >
      <h1 className="text-[23px] leading-tight font-bold text-balance text-foreground">{title}</h1>
      {message && <p className="-mt-2 max-w-[52ch] text-[13.5px] text-muted-foreground">{message}</p>}
      {children}
    </section>
  );
}
