import type { ComponentProps } from 'react';
import { useFullview } from '../../stores/use-fullview';
import { GuideContent } from './GuideContent';

export function GuidePage(props: ComponentProps<typeof GuideContent>) {
  const widened = useFullview((s) => s.historyOpen || s.transcriptOpen);
  return (
    <main className="flex-1 py-10 px-6">
      <div className={`mx-auto ${widened ? 'max-w-[1032px]' : 'max-w-[720px]'}`}>
        <GuideContent {...props} />
      </div>
    </main>
  );
}
