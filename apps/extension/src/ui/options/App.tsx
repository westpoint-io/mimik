import { useCardOnIcon } from '@/ui/shared/hooks/use-card-on-icon';
import { SettingsView } from '@/ui/shared/SettingsView';

export function App() {
  useCardOnIcon();
  return <SettingsView layout="sections" />;
}
