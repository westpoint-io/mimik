import { Check, Eye, EyeOff, TriangleAlert } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { i18n } from '#imports';
import { sendMessage } from '@/lib/messaging';
import { Input } from '@/ui/components/ui/input';

export type KeyStatus = 'checking' | 'valid' | 'rejected' | 'unreachable' | 'model-required' | 'model-invalid' | null;

export type KeyWarning = 'cannot-spend';

export function useKeyCheck() {
  const [status, setStatus] = useState<KeyStatus>(null);
  const [models, setModels] = useState<string[] | null>(null);
  const [warning, setWarning] = useState<KeyWarning | null>(null);
  const validated = useRef('');
  const requestId = useRef(0);

  const check = useCallback(async (provider: string, apiKey: string, baseUrl?: string, model?: string) => {
    const fingerprint = `${provider}:${apiKey}:${baseUrl ?? ''}:${model ?? ''}`;
    if (validated.current === fingerprint) {
      setStatus('valid');
      return;
    }
    const currentRequestId = ++requestId.current;
    setStatus('checking');
    setModels(null);
    setWarning(null);
    const result = await sendMessage('validateApiKey', { provider, apiKey, baseUrl, model }).catch(() => null);
    if (requestId.current !== currentRequestId) return;
    if (result?.valid) validated.current = fingerprint;
    setModels(result?.models?.length ? result.models : null);
    setWarning(result?.valid && result.warning ? result.warning : null);
    setStatus(
      result?.valid
        ? 'valid'
        : result?.reason === 'rejected'
          ? 'rejected'
          : result?.reason === 'model-required'
            ? 'model-required'
            : result?.reason === 'model-invalid'
              ? 'model-invalid'
              : 'unreachable',
    );
  }, []);

  const reset = useCallback(() => {
    requestId.current += 1;
    validated.current = '';
    setStatus(null);
    setModels(null);
    setWarning(null);
  }, []);

  return { status, models, warning, check, reset };
}

export function KeyStatusNote({ status }: { status: KeyStatus }) {
  if (status === 'checking') {
    return <p className="mt-1 text-[11px] text-muted-foreground">{i18n.t('settings.validatingKey')}</p>;
  }
  if (status === 'valid') {
    return (
      <p className="mt-1 text-[11px] flex items-center gap-1" style={{ color: 'var(--color-success)' }}>
        <Check size={11} />
        {i18n.t('settings.keyValid')}
      </p>
    );
  }
  if (status === 'rejected') {
    return (
      <p className="mt-1 text-[11px] text-destructive" role="alert">
        {i18n.t('settings.keyInvalid')}
      </p>
    );
  }
  if (status === 'unreachable') {
    return <p className="mt-1 text-[11px] text-muted-foreground">{i18n.t('settings.keyUnreachable')}</p>;
  }
  if (status === 'model-required') {
    return (
      <p className="mt-1 text-[11px] text-destructive" role="alert">
        {i18n.t('settings.keyModelRequired')}
      </p>
    );
  }
  if (status === 'model-invalid') {
    return (
      <p className="mt-1 text-[11px] text-destructive" role="alert">
        {i18n.t('settings.keyModelInvalid')}
      </p>
    );
  }
  return null;
}

export function KeyWarningNote({ warning }: { warning: KeyWarning | null }) {
  if (!warning) return null;
  return (
    <p className="mt-1 flex items-start gap-1.5 text-[10px] text-foreground leading-relaxed" role="status">
      <TriangleAlert size={11} className="shrink-0 mt-0.5 text-destructive" />
      <span>{i18n.t('settings.keyCannotSpend')}</span>
    </p>
  );
}

export function ModelList({ models }: { models: string[] }) {
  return (
    <div className="mt-1.5 rounded-lg bg-secondary px-2.5 py-2">
      <p className="text-[10px] font-semibold text-muted-foreground mb-1">
        {i18n.t('settings.modelsFound', [String(models.length)])}
      </p>
      <ul
        className="max-h-24 overflow-y-auto space-y-0.5"
        aria-label={i18n.t('settings.modelsFound', [String(models.length)])}
      >
        {models.map((id) => (
          <li key={id} className="text-[10px] text-foreground truncate font-mono">
            {id}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SecretInput({
  value,
  onChange,
  placeholder,
  className,
  buttonClassName,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const Icon = revealed ? EyeOff : Eye;
  return (
    <div className="relative flex-1 min-w-0">
      <Input
        type={revealed ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`pr-8 ${className ?? ''}`}
      />
      <button
        type="button"
        onClick={() => setRevealed((on) => !on)}
        aria-pressed={revealed}
        aria-label={i18n.t(revealed ? 'settings.hideKey' : 'settings.showKey')}
        title={i18n.t(revealed ? 'settings.hideKey' : 'settings.showKey')}
        className={`absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors ${buttonClassName ?? ''}`}
      >
        <Icon size={13} />
      </button>
    </div>
  );
}
