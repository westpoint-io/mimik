import { i18n } from '@mimik/core/env';
import { Button } from '@mimik/ui';
import { Check, Download, Loader2, RefreshCw, RotateCcw, TriangleAlert } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import type { UpdateStatus } from '../../main/ipc';
import { useUpdateStatus } from '../hooks/use-update-status';
import { Card } from './Card';
import { Row } from './Row';

type Phase = UpdateStatus['phase'];

export function UpdatesCard() {
  const [version, setVersion] = useState('');
  const status = useUpdateStatus();

  useEffect(() => {
    window.mimik.version().then(setVersion);
  }, []);

  const phase = status?.phase ?? 'idle';
  const percent = status?.percent ?? 0;
  const next = status?.version ?? '';
  const checkedAt = status?.checkedAt ? new Date(status.checkedAt) : null;
  const sameDay = checkedAt?.toDateString() === new Date().toDateString();
  const lastChecked = checkedAt
    ? i18n.t('desktop.lastChecked', [
        checkedAt.toLocaleString(
          undefined,
          sameDay ? { timeStyle: 'short' } : { dateStyle: 'medium', timeStyle: 'short' },
        ),
      ])
    : i18n.t('desktop.versionHint');
  const hints: Record<Phase, ReactNode> = {
    idle: lastChecked,
    checking: lastChecked,
    downloading: i18n.t('desktop.versionAvailable', [next]),
    ready: <span className="text-foreground">{i18n.t('desktop.versionDownloaded', [next])}</span>,
    unavailable: i18n.t('desktop.updatesUnavailable'),
    upToDate: (
      <span className="flex items-center gap-1.5 text-success">
        <Check size={13} />
        {i18n.t('desktop.upToDate')}
      </span>
    ),
    error: (
      <span className="flex items-center gap-1.5 text-destructive">
        <TriangleAlert size={13} />
        {i18n.t('desktop.updateFailed')}
      </span>
    ),
  };
  const labels: Partial<Record<Phase, string>> = {
    checking: i18n.t('desktop.checking'),
    downloading: i18n.t('desktop.downloading', [String(percent)]),
    error: i18n.t('desktop.tryAgain'),
  };
  const icons: Partial<Record<Phase, ReactNode>> = {
    checking: <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />,
    downloading: <Download size={14} />,
  };
  const busy = phase === 'checking' || phase === 'downloading';

  return (
    <Card icon={RefreshCw} title={i18n.t('desktop.cardUpdates')}>
      <Row
        label={i18n.t('desktop.version', [version])}
        hint={
          <span className="flex flex-col gap-1.5" role="status">
            {hints[phase]}
            {phase === 'downloading' && (
              <span className="block h-1 w-60 overflow-hidden rounded-full bg-secondary">
                <span className="block h-1 rounded-full bg-violet" style={{ width: `${percent}%` }} />
              </span>
            )}
          </span>
        }
      >
        {phase === 'ready' ? (
          <Button size="sm" onClick={() => window.mimik.updates.install()}>
            <RotateCcw size={14} />
            {i18n.t('desktop.restartToUpdate')}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="min-w-44"
            disabled={busy}
            onClick={() => window.mimik.updates.check()}
          >
            {icons[phase] ?? <RefreshCw size={14} />}
            {labels[phase] ?? i18n.t('desktop.checkUpdates')}
          </Button>
        )}
      </Row>
    </Card>
  );
}
