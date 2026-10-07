import { i18n } from '@mimik/core/env';

export function ModelList({ models }: { models: string[] }) {
  return (
    <div className="mt-1.5 rounded-lg bg-secondary px-2.5 py-2">
      <p className="text-[10px] font-semibold text-muted-foreground mb-1">
        {i18n.t('settings.modelsFound', [String(models.length)])}
      </p>
      <ul
        className="max-h-24 overflow-y-auto space-y-0.5"
        aria-label={i18n.t('settings.modelsFound', [String(models.length)])}
      >
        {models.map((id) => (
          <li key={id} className="text-[10px] text-foreground truncate font-mono">
            {id}
          </li>
        ))}
      </ul>
    </div>
  );
}
