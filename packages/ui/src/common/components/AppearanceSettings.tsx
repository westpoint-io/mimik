import { i18n } from '@mimik/core/env';
import { Monitor, Moon, Sun, SunMoon } from 'lucide-react';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { SettingsCard } from './SettingsCard';

type Theme = 'system' | 'light' | 'dark';

const KEY = 'mimikTheme';

export function AppearanceSettings() {
  const [theme, setTheme] = useState<Theme>(() => (window.localStorage.getItem(KEY) as Theme | null) ?? 'system');

  const change = (next: string) => {
    setTheme(next as Theme);
    window.localStorage.setItem(KEY, next);
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
  };

  const options = [
    { value: 'system', label: i18n.t('settings.themeSystem'), Icon: Monitor },
    { value: 'light', label: i18n.t('settings.themeLight'), Icon: Sun },
    { value: 'dark', label: i18n.t('settings.themeDark'), Icon: Moon },
  ];

  return (
    <SettingsCard
      icon={SunMoon}
      title={i18n.t('settings.appearance')}
      hint={i18n.t('settings.appearanceHint')}
      action={
        <Select value={theme} onValueChange={change}>
          <SelectTrigger aria-label={i18n.t('settings.appearance')} className="h-8 w-[140px] shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map(({ value, label, Icon }) => (
              <SelectItem key={value} value={value}>
                <span className="flex items-center gap-2">
                  <Icon size={14} className="text-accent" />
                  {label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    />
  );
}
