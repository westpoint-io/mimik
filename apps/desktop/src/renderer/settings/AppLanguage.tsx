import { AI_LANGUAGES } from '@mimik/core/capture/ai/prompts';
import { i18n, localStorage } from '@mimik/core/env';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mimik/ui';
import { useEffect, useState } from 'react';
import { REOPEN_SETTINGS } from './lib/reopen-settings';

export function AppLanguage() {
  const [chosen, setChosen] = useState('system');

  useEffect(() => {
    localStorage.get(['appLanguage']).then(({ appLanguage }) => appLanguage && setChosen(appLanguage));
  }, []);

  const change = async (next: string) => {
    setChosen(next);
    await localStorage.set({ appLanguage: next });
    sessionStorage.setItem(REOPEN_SETTINGS, 'general');
    window.mimik.relocalise();
  };

  return (
    <Select value={chosen} onValueChange={change}>
      <SelectTrigger aria-label={i18n.t('desktop_appLanguage')} className="h-9 w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="system">{i18n.t('desktop_languageSystem')}</SelectItem>
        {AI_LANGUAGES.map((language) => (
          <SelectItem key={language.code} value={language.code}>
            {language.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
