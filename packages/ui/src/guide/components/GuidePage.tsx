import type { ComponentProps } from 'react';
import { GuideContent } from './GuideContent';

export function GuidePage(props: ComponentProps<typeof GuideContent>) {
  return (
    <main className="flex-1 py-10 px-6">
      <GuideContent {...props} />
    </main>
  );
}
