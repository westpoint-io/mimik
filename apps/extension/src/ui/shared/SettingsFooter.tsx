import { i18n } from '@mimik/core/env';
import { Bug, ChevronRight, Shield, Star } from 'lucide-react';

export function SettingsFooter() {
  return (
    <>
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-secondary text-[10px] text-muted-foreground leading-relaxed">
        <Shield size={12} className="shrink-0 mt-0.5 text-accent" />
        <span>{i18n.t('settings.privacyNotice')}</span>
      </div>

      <a
        href="https://github.com/westpoint-io/mimik/issues"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-accent transition-colors"
      >
        <Bug size={13} className="shrink-0" />
        <span>{i18n.t('settings.bugReport')}</span>
      </a>

      <div className="flex items-center gap-3.5 border border-border rounded-[10px] p-3.5">
        <svg width="44" height="44" viewBox="20 55 160 108" className="shrink-0">
          <rect x="30" y="95" width="140" height="68" rx="8" fill="#1E1B4B" />
          <path d="M30 95 L30 80 Q30 58, 100 58 Q170 58, 170 80 L170 95 Z" fill="#3730A3" />
          <rect x="30" y="93" width="140" height="3" fill="#C7D2FE" />
          <path d="M68 122 Q76 112 84 122" stroke="#C7D2FE" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M116 122 Q124 112 132 122" stroke="#C7D2FE" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M84 138 Q100 148 116 138" stroke="#C7D2FE" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-foreground mb-0.5">{i18n.t('settings.starCtaTitle')}</p>
          <p className="text-[10px] text-muted-foreground leading-relaxed mb-2">{i18n.t('settings.starCtaMessage')}</p>
          <a
            href="https://github.com/westpoint-io/mimik"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-[10px] font-semibold text-accent hover:bg-accent hover:text-white transition-colors"
          >
            <Star size={11} fill="#FBBF24" className="text-[#FBBF24]" />
            {i18n.t('settings.starOnGithub')}
            <ChevronRight size={11} />
          </a>
        </div>
      </div>
    </>
  );
}
