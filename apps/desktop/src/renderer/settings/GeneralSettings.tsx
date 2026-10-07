import { i18n } from '@mimik/core/env';
import { Button, Switch } from '@mimik/ui';
import { Bug, Github, Languages, Power, RefreshCw, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppLanguage } from './AppLanguage';
import { Card } from './Card';
import { Row } from './Row';

const REPO_URL = 'https://github.com/westpoint-io/mimik';

const LOGIN_HINT = navigator.userAgent.includes('Mac') ? 'desktop.startAtLoginHintMac' : 'desktop.startAtLoginHint';

export function GeneralSettings({ onSaved }: { onSaved: () => void }) {
  const [version, setVersion] = useState('');
  const [atLogin, setAtLogin] = useState(false);

  useEffect(() => {
    window.mimik.version().then(setVersion);
    window.mimik.openAtLogin.get().then(setAtLogin);
  }, []);

  return (
    <>
      <Card icon={Languages} title={i18n.t('desktop.cardLanguage')}>
        <Row label={i18n.t('desktop.appLanguage')} hint={i18n.t('desktop.appLanguageHint')}>
          <AppLanguage />
        </Row>
      </Card>

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

      <Card icon={RefreshCw} title={i18n.t('desktop.cardUpdates')}>
        <Row label={i18n.t('desktop.version', [version])} hint={i18n.t('desktop.versionHint')}>
          <Button variant="outline" size="sm" onClick={() => window.mimik.updates.check()}>
            <RefreshCw size={14} />
            {i18n.t('desktop.checkUpdates')}
          </Button>
        </Row>
      </Card>

      <Card icon={Github} title={i18n.t('desktop.cardGithub')}>
        <Row label={i18n.t('settings.starCtaTitle')} hint={i18n.t('settings.starCtaMessage')}>
          <Button variant="outline" size="sm" onClick={() => window.open(REPO_URL, '_blank')}>
            <Star size={14} />
            {i18n.t('settings.starOnGithub')}
          </Button>
        </Row>
        <Row label={i18n.t('desktop.bugTitle')} hint={i18n.t('desktop.bugHint')}>
          <Button variant="outline" size="sm" onClick={() => window.open(`${REPO_URL}/issues`, '_blank')}>
            <Bug size={14} />
            {i18n.t('desktop.reportBug')}
          </Button>
        </Row>
      </Card>
    </>
  );
}
