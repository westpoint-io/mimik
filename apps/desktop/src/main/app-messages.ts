import type { Messages } from '@mimik/core/i18n/translate';
import de from '@mimik/locales/de.yml';
import en from '@mimik/locales/en.yml';
import es from '@mimik/locales/es.yml';
import fr from '@mimik/locales/fr.yml';
import ptBR from '@mimik/locales/pt-BR.yml';
import ru from '@mimik/locales/ru.yml';
import zhCN from '@mimik/locales/zh-CN.yml';
import type { AppLocale } from './app-locale';

export const APP_MESSAGES: Record<AppLocale, Messages> = {
  en: en as Messages,
  de: de as Messages,
  es: es as Messages,
  fr: fr as Messages,
  'pt-BR': ptBR as Messages,
  'zh-CN': zhCN as Messages,
  ru: ru as Messages,
};
