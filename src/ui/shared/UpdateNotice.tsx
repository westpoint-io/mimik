import { Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { i18n } from '#imports';
import { dismissUpdateNotice, readUpdateNotice } from '@/lib/update-notice';

const RELEASES_URL = 'https://github.com/westpoint-io/mimik/releases';

export default function UpdateNotice({ className = '' }: { className?: string }) {
  const [version, setVersion] = useState<string>();

  useEffect(() => {
    readUpdateNotice().then(setVersion);
  }, []);

  if (!version) return null;

  const dismiss = () => {
    setVersion(undefined);
    dismissUpdateNotice();
  };

  return (
    <div
      role="status"
      className={`flex items-center gap-2 rounded-xl border border-border bg-card shadow-lg px-3.5 py-2.5 ${className}`}
    >
      <Sparkles size={15} className="shrink-0 text-accent" />
      <span className="text-[12px] font-semibold text-foreground">{i18n.t('common.updated', [version])}</span>
      <a
        href={RELEASES_URL}
        target="_blank"
        rel="noreferrer"
        onClick={dismiss}
        className="text-[11px] font-semibold text-accent hover:underline"
      >
        {i18n.t('common.whatsNew')}
      </a>
      <button
        onClick={dismiss}
        aria-label={i18n.t('common.close')}
        className="ml-auto shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}
