import { i18n } from '@mimik/core/env';
import { Languages } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { tabs } from '../../env';

const REVIEWED_LOCALES = ['en', 'es', 'pt-BR'];
const EDIT_URL = 'https://github.com/westpoint-io/mimik/edit/dev/packages/locales';

export function TranslationNotice() {
  const locale = i18n.t('meta.locale');
  if (REVIEWED_LOCALES.includes(locale)) return null;

  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-3.5">
      <Languages size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] leading-snug text-muted-foreground">{i18n.t('settings.machineTranslated')}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void tabs.create(`${EDIT_URL}/${locale}.yml`)}
          className="mt-2.5 rounded-lg text-[12px] font-semibold"
        >
          {i18n.t('settings.fixTranslation')}
        </Button>
      </div>
    </div>
  );
}
