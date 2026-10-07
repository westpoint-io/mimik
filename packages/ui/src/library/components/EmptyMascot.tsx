import { NoGuidesMascot } from './NoGuidesMascot';
import { StarredMascot } from './StarredMascot';
import { TrashMascot } from './TrashMascot';

export function EmptyMascot({ category }: { category: string }) {
  if (category === 'starred') return <StarredMascot />;
  if (category === 'trash') return <TrashMascot />;
  return <NoGuidesMascot />;
}
