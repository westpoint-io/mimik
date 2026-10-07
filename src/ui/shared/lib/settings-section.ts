import { EyeOff, ImageIcon, Keyboard, KeyRound, Sparkles } from 'lucide-react';

export const SETTINGS_SECTIONS = [
  { id: 'ai', label: 'settings.aiSection', Icon: Sparkles },
  { id: 'branding', label: 'settings.branding', Icon: ImageIcon },
  { id: 'smart-blur', label: 'settings.smartBlur', Icon: EyeOff },
  { id: 'keyboard', label: 'settings.cardKeyboard', Icon: Keyboard },
  { id: 'api-keys', label: 'settings.apiKeys', Icon: KeyRound },
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]['id'];

export function settingsSection(hash: string): SettingsSection {
  const id = hash.replace(/^#/, '');
  return SETTINGS_SECTIONS.find((section) => section.id === id)?.id ?? 'ai';
}
