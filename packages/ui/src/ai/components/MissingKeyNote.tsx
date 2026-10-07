import { i18n } from '@mimik/core/env';
import { TriangleAlert } from 'lucide-react';

export function MissingKeyNote({ text, onOpenKeys }: { text: string; onOpenKeys?: () => void }) {
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-[10px] text-destructive leading-relaxed" role="alert">
      <TriangleAlert size={11} className="shrink-0 mt-0.5" />
      <span>
        {text}{' '}
        {onOpenKeys ? (
          <button type="button" onClick={onOpenKeys} className="font-semibold underline-offset-2 hover:underline">
            {i18n.t('settings.addOneInKeys')}
          </button>
        ) : (
          i18n.t('settings.addOneInKeys')
        )}
      </span>
    </p>
  );
}
