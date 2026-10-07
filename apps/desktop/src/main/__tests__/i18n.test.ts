import { describe, expect, it, vi } from 'vitest';

vi.mock('@mimik/locales/en.yml', () => ({
  default: { desktop: { trayQuit: 'Quit Mimik', upToDateMessage: 'Mimik $1 is current.', later: 'Later' } },
}));
vi.mock('@mimik/locales/pt-BR.yml', () => ({ default: { desktop: { trayQuit: 'Sair do Mimik' } } }));
vi.mock('@mimik/locales/de.yml', () => ({ default: {} }));
vi.mock('@mimik/locales/es.yml', () => ({ default: {} }));
vi.mock('@mimik/locales/fr.yml', () => ({ default: {} }));
vi.mock('@mimik/locales/zh-CN.yml', () => ({ default: {} }));
vi.mock('@mimik/locales/ru.yml', () => ({ default: {} }));

import { mainI18n } from '../i18n';

describe('mainI18n', () => {
  it('matches a regional locale to its language and falls back to English per key', () => {
    mainI18n.setLocale('pt-PT');
    expect(mainI18n.t('desktop.trayQuit')).toBe('Sair do Mimik');
    expect(mainI18n.t('desktop.later')).toBe('Later');
    expect(mainI18n.t('desktop.upToDateMessage', ['1.2.0'])).toBe('Mimik 1.2.0 is current.');
    expect(mainI18n.t('desktop.missing')).toBe('desktop.missing');

    mainI18n.setLocale('ja-JP');
    expect(mainI18n.t('desktop.trayQuit')).toBe('Quit Mimik');
  });
});
