import { i18n } from '@mimik/core/env';
import { Eye, EyeOff, X } from 'lucide-react';
import { useState } from 'react';
import { Input } from '../../components/ui/input';

export function SecretInput({
  value,
  onChange,
  onBlur,
  placeholder,
  className,
  buttonClassName,
}: {
  value: string;
  onChange: (next: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const Icon = revealed ? EyeOff : Eye;
  const iconButton = `top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors ${buttonClassName ?? ''}`;
  return (
    <div className="relative flex-1 min-w-0">
      <Input
        type={revealed ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className={`${value ? 'pr-14' : 'pr-8'} ${className ?? ''}`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={i18n.t('settings.clearKey')}
          title={i18n.t('settings.clearKey')}
          className={`absolute right-8 ${iconButton}`}
        >
          <X size={13} />
        </button>
      )}
      <button
        type="button"
        onClick={() => setRevealed((on) => !on)}
        aria-pressed={revealed}
        aria-label={i18n.t(revealed ? 'settings.hideKey' : 'settings.showKey')}
        title={i18n.t(revealed ? 'settings.hideKey' : 'settings.showKey')}
        className={`absolute right-2 ${iconButton}`}
      >
        <Icon size={13} />
      </button>
    </div>
  );
}
