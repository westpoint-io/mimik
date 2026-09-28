import de from '@mimik/locales/de.yml';
import en from '@mimik/locales/en.yml';
import es from '@mimik/locales/es.yml';
import fr from '@mimik/locales/fr.yml';
import ptBR from '@mimik/locales/pt-BR.yml';
import zhCN from '@mimik/locales/zh-CN.yml';

type Messages = { [key: string]: string | Messages };

const LOCALES: Record<string, Messages> = {
  en: en as Messages,
  de: de as Messages,
  es: es as Messages,
  fr: fr as Messages,
  'pt-BR': ptBR as Messages,
  'zh-CN': zhCN as Messages,
};
const active = { locale: 'en' };

function lookup(messages: Messages, key: string): string | undefined {
  const found = key
    .split('.')
    .reduce<string | Messages | undefined>(
      (node, part) => (typeof node === 'object' ? node[part] : undefined),
      messages,
    );
  return typeof found === 'string' ? found : undefined;
}

export const mainI18n = {
  setLocale(code: string): void {
    const language = code.split('-')[0];
    active.locale = LOCALES[code] ? code : (Object.keys(LOCALES).find((l) => l.split('-')[0] === language) ?? 'en');
  },
  t(key: string, substitutions: string[] = []): string {
    const text = lookup(LOCALES[active.locale], key) ?? lookup(LOCALES.en, key) ?? key;
    return substitutions.reduce((out, value, i) => out.replaceAll(`$${i + 1}`, value), text);
  },
};
