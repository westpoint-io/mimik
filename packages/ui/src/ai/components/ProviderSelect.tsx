import type { KeyProvider } from '@mimik/core/capture/ai/keys';
import { i18n } from '@mimik/core/env';
import { Check, Server } from 'lucide-react';
import { Select as SelectPrimitive } from 'radix-ui';
import { useState } from 'react';
import { Select, SelectContent, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ProviderLogo } from './ProviderLogo';

export interface ProviderOption<T extends string> {
  value: T;
  label: string;
  logo: KeyProvider | 'server';
  available: boolean;
}

interface ProviderSelectProps<T extends string> {
  value: T;
  options: ProviderOption<T>[];
  onChange: (value: T) => void;
  onOpenKeys?: () => void;
  triggerClassName?: string;
}

export function ProviderSelect<T extends string>({
  value,
  options,
  onChange,
  onOpenKeys,
  triggerClassName,
}: ProviderSelectProps<T>) {
  const [open, setOpen] = useState(false);

  return (
    <Select open={open} onOpenChange={setOpen} value={value} onValueChange={(next) => onChange(next as T)}>
      <SelectTrigger className={triggerClassName ?? 'h-8'}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectPrimitive.Item
            key={option.value}
            value={option.value}
            disabled={!option.available}
            className="relative flex cursor-pointer select-none items-center gap-2 rounded-md py-1.5 pl-2 pr-7 text-[13px] text-foreground outline-none data-[disabled]:cursor-default data-[disabled]:text-muted-foreground/60 data-[highlighted]:bg-secondary"
          >
            <SelectPrimitive.ItemText>
              <span className="flex items-center gap-2">
                {option.logo === 'server' ? <Server size={14} /> : <ProviderLogo provider={option.logo} size={14} />}
                {option.label}
              </span>
            </SelectPrimitive.ItemText>
            {!option.available &&
              (onOpenKeys ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onOpenKeys();
                  }}
                  className="pointer-events-auto ml-auto text-[11px] font-semibold text-foreground hover:underline"
                >
                  {i18n.t('settings.addKey')}
                </button>
              ) : (
                <span className="ml-auto text-[11px]">{i18n.t('settings.noKey')}</span>
              ))}
            <span className="absolute right-2 flex items-center">
              <SelectPrimitive.ItemIndicator>
                <Check size={13} className="text-accent" />
              </SelectPrimitive.ItemIndicator>
            </span>
          </SelectPrimitive.Item>
        ))}
      </SelectContent>
    </Select>
  );
}
