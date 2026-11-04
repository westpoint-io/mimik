import { i18n } from '@mimik/core/env';
import { MODES } from './lib/modes';

export function ModeBadge({ mode }: { mode: string }) {
  const shown = MODES.find((candidate) => candidate.id === mode) ?? MODES[0];
  return (
    <>
      <shown.Icon size={12} />
      {i18n.t(shown.label)}
    </>
  );
}
