import { i18n } from '@mimik/core/env';
import { AppearanceSettings, GitHubCard, Switch } from '@mimik/ui';
import { Languages, Power } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppLanguage } from './AppLanguage';
import { Card } from './Card';
import { Row } from './Row';
import { UpdatesCard } from './UpdatesCard';

const LOGIN_HINT = navigator.userAgent.includes('Mac') ? 'desktop.startAtLoginHintMac' : 'desktop.startAtLoginHint';

export function GeneralSettings({ onSaved }: { onSaved: () => void }) {
  const [atLogin, setAtLogin] = useState(false);

  useEffect(() => {
    window.mimik.openAtLogin.get().then(setAtLogin);
  }, []);

  return (
    <>
      <Card icon={Languages} title={i18n.t('desktop.cardLanguage')}>
        <Row label={i18n.t('desktop.appLanguage')} hint={i18n.t('desktop.appLanguageHint')}>
          <AppLanguage />
        </Row>
      </Card>

      <AppearanceSettings />

      <Card icon={Power} title={i18n.t('desktop.cardStartup')}>
        <Row label={i18n.t('desktop.startAtLogin')} hint={i18n.t(LOGIN_HINT)}>
          <Switch
            checked={atLogin}
            label={i18n.t('desktop.startAtLogin')}
            onChange={async (next) => {
              setAtLogin(await window.mimik.openAtLogin.set(next));
              onSaved();
            }}
          />
        </Row>
      </Card>

      <UpdatesCard />

      <GitHubCard />
    </>
  );
}
