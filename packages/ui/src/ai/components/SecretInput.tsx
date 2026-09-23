import { i18n } from '@mimik/core/env';
import { Input } from '@mimik/ui/components/ui/input';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

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
