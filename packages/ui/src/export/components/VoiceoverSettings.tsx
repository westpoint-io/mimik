import { type ApiKeys, KEY_PROVIDER_LABELS } from '@mimik/core/capture/ai/keys';
import { i18n } from '@mimik/core/env';
import {
  VOICEOVER_PROVIDER_KEYS,
  VOICEOVER_PROVIDERS,
  voiceoverProvider,
} from '@mimik/core/export/voiceover/providers';
import { AudioLines } from 'lucide-react';
import { MissingKeyNote } from '../../ai/components/MissingKeyNote';
import { ProviderSelect } from '../../ai/components/ProviderSelect';
import { SettingsCard } from '../../common/components/SettingsCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { type ListVoices, useVoiceoverSettings } from '../hooks/use-voiceover-settings';

interface VoiceoverSettingsProps {
  keys: ApiKeys;
  listVoices?: ListVoices;
  onOpenKeys?: () => void;
  onChange?: (patch: Record<string, unknown>) => void;
}

export function VoiceoverSettings({ keys, listVoices, onOpenKeys, onChange }: VoiceoverSettingsProps) {
  const voiceover = useVoiceoverSettings(keys, listVoices, onChange);

  return (
    <SettingsCard
      icon={AudioLines}
      title={i18n.t('settings.voiceover')}
      hint={i18n.t('settings.voiceoverHint')}
      action={
        <span className="shrink-0 rounded-md bg-secondary px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-muted-foreground">
          {i18n.t('settings.textToSpeech')}
        </span>
      }
    >
      <div>
        <label className="block text-[11px] font-semibold text-foreground mb-1">{i18n.t('settings.provider')}</label>
        <ProviderSelect
          value={voiceover.provider}
          onChange={voiceover.setProvider}
          onOpenKeys={onOpenKeys}
          options={VOICEOVER_PROVIDER_KEYS.map((key) => ({
            value: key,
            label: VOICEOVER_PROVIDERS[key].label,
            logo: key,
            available: Boolean(keys[key]?.trim()),
          }))}
        />
        {!voiceover.hasKey && (
          <MissingKeyNote
            text={i18n.t('settings.noKeyFor', [KEY_PROVIDER_LABELS[voiceover.provider]])}
            onOpenKeys={onOpenKeys}
          />
        )}
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-foreground mb-1">{i18n.t('settings.voice')}</label>
        <Select value={voiceover.voiceId} onValueChange={voiceover.setVoiceId}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {voiceover.voices.map((voice) => (
              <SelectItem key={voice.id} value={voice.id}>
                {voice.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-foreground mb-1">{i18n.t('settings.model')}</label>
        <Select value={voiceover.modelId} onValueChange={voiceover.setModelId}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {voiceoverProvider(voiceover.provider).models.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </SettingsCard>
  );
}
