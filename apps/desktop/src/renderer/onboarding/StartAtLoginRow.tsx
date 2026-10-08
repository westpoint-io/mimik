import { i18n } from '@mimik/core/env';
import { OnboardingRow, Switch } from '@mimik/ui';
import { useEffect, useState } from 'react';
import { LoginPicture } from './LoginPicture';

const MAC = navigator.userAgent.includes('Mac');

export function StartAtLoginRow() {
  const [atLogin, setAtLogin] = useState(false);

  useEffect(() => {
    void window.mimik.openAtLogin.get().then(setAtLogin);
  }, []);

  return (
    <OnboardingRow
      picture={<LoginPicture mac={MAC} />}
      title={i18n.t('desktop.startAtLogin')}
      hint={i18n.t(MAC ? 'desktop.startAtLoginHintMac' : 'desktop.startAtLoginHint')}
      control={
        <Switch
          checked={atLogin}
          label={i18n.t('desktop.startAtLogin')}
          onChange={async (next) => setAtLogin(await window.mimik.openAtLogin.set(next))}
        />
      }
    />
  );
}
