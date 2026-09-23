import { i18n } from '@mimik/core/env';

export default function EmptyGuideState() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-[300px]">
      <div className="relative">
        <svg width="72" height="54" viewBox="20 50 160 120" className="block">
          <rect x="30" y="95" width="140" height="68" rx="5" className="fill-primary" />
          <path d="M30 95 L30 80 Q30 60, 100 60 Q170 60, 170 80 L170 95 Z" className="fill-violet-mid" />
          <rect x="30" y="93" width="140" height="3" className="fill-lavender" />
          <line x1="66" y1="120" x2="86" y2="120" className="stroke-lavender" strokeWidth="4" strokeLinecap="round" />
          <line x1="114" y1="120" x2="134" y2="120" className="stroke-lavender" strokeWidth="4" strokeLinecap="round" />
          <path
            d="M88 140 Q100 145 112 140"
            className="stroke-lavender"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute -top-2 -right-3 flex gap-0.5 text-muted-foreground/40">
          <span className="text-sm animate-pulse">z</span>
          <span className="text-xs animate-pulse [animation-delay:400ms]">z</span>
          <span className="text-[10px] animate-pulse [animation-delay:800ms]">z</span>
        </div>
      </div>
      <p className="text-sm font-medium text-foreground mt-5">{i18n.t('emptyGuide.title')}</p>
      <p className="text-xs text-muted-foreground mt-1">{i18n.t('emptyGuide.subtitle')}</p>
    </div>
  );
}
