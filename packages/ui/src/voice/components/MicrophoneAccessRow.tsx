import { i18n } from '@mimik/core/env';
import { ExternalLink, Mic, MicOff } from 'lucide-react';
import { Button } from '../../components/ui/button';

interface MicrophoneAccessRowProps {
  refused: boolean;
  hint: string;
  action: string;
  external?: boolean;
  onRequest: () => void;
}

export function MicrophoneAccessRow({ refused, hint, action, external = false, onRequest }: MicrophoneAccessRowProps) {
  const Icon = refused ? MicOff : Mic;
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] border border-border p-2.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-secondary">
        <Icon size={15} className={refused ? 'text-destructive' : 'text-accent'} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-foreground">{i18n.t('settings.microphoneAccess')}</p>
        <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>
      </div>
      <Button
        size="sm"
        variant={refused ? 'outline' : 'default'}
        onClick={onRequest}
        className="h-7 shrink-0 rounded-lg text-[11px]"
      >
        {external && <ExternalLink size={12} />}
        {action}
      </Button>
    </div>
  );
}
