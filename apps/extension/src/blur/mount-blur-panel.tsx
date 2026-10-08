import type { PresetKey } from '@/core/blur/patterns';
import { mountInPage } from '@/page-ui/mount-in-page';
import { BlurPanel } from './BlurPanel';

export function mountBlurPanel(presets: Record<PresetKey, boolean>): () => void {
  const page = mountInPage();
  page.render(<BlurPanel initial={presets} />);
  return page.unmount;
}
