import { i18n } from '@mimik/core/env';
import { Button, Switch } from '@mimik/ui';
import { Languages, Power, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppLanguage } from './AppLanguage';
import { Card } from './Card';
import { Row } from './Row';

const LOGIN_HINT = navigator.userAgent.includes('Mac') ? 'desktop_startAtLoginHintMac' : 'desktop_startAtLoginHint';

export function GeneralSettings() {
  const [version, setVersion] = useState('');
  const [atLogin, setAtLogin] = useState(false);

  useEffect(() => {
    window.mimik.version().then(setVersion);
    window.mimik.openAtLogin.get().then(setAtLogin);
  }, []);

  return (
    <>
      <Card icon={Languages} title={i18n.t('desktop_cardLanguage')}>
        <Row label={i18n.t('desktop_appLanguage')} hint={i18n.t('desktop_appLanguageHint')}>
          <AppLanguage />
        </Row>
      </Card>

      <Card icon={Power} title={i18n.t('desktop_cardStartup')}>
        <Row label={i18n.t('desktop_startAtLogin')} hint={i18n.t(LOGIN_HINT)}>
          <Switch
            checked={atLogin}
            label={i18n.t('desktop_startAtLogin')}
            onChange={async (next) => setAtLogin(await window.mimik.openAtLogin.set(next))}
          />
        </Row>
      </Card>

      <Card icon={RefreshCw} title={i18n.t('desktop_cardUpdates')}>
        <Row label={i18n.t('desktop_version', [version])} hint={i18n.t('desktop_versionHint')}>
          <Button variant="outline" size="sm" onClick={() => window.mimik.updates.check()}>
            <RefreshCw size={14} />
            {i18n.t('desktop_checkUpdates')}
          </Button>
        </Row>
      </Card>
    </>
  );
}
