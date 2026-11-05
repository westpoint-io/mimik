import { KEY_PROVIDER_LABELS, SERVER } from '@mimik/core/capture/ai/keys';
import { i18n } from '@mimik/core/env';
import {
  VOICEOVER_PROVIDER_KEYS,
  VOICEOVER_PROVIDERS,
  type VoiceoverProviderKey,
  voiceoverProvider,
} from '@mimik/core/export/voiceover/providers';
import { AudioLines } from 'lucide-react';
import { MissingKeyNote } from '../../ai/components/MissingKeyNote';
import { type ProviderOption, ProviderSelect } from '../../ai/components/ProviderSelect';
import type { ApiKeysState } from '../../ai/hooks/use-api-keys';
import { SettingsCard } from '../../common/components/SettingsCard';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { type ListVoices, useVoiceoverSettings } from '../hooks/use-voiceover-settings';

interface VoiceoverSettingsProps {
  keys: ApiKeysState;
  listVoices?: ListVoices;
  onOpenKeys?: () => void;
  onChange?: (patch: Record<string, unknown>) => void;
}

export function VoiceoverSettings({ keys, listVoices, onOpenKeys, onChange }: VoiceoverSettingsProps) {
  const voiceover = useVoiceoverSettings(keys, listVoices, onChange);
  const server = voiceoverProvider(SERVER);

  const options: ProviderOption<VoiceoverProviderKey>[] = [
    ...VOICEOVER_PROVIDER_KEYS.filter((key) => key !== SERVER).map((key) => ({
      value: key,
      label: VOICEOVER_PROVIDERS[key].label,
      logo: key,
      available: Boolean(keys.keys[key]?.trim()),
    })),
    { value: SERVER, label: i18n.t('settings.ownServer'), logo: SERVER, available: voiceover.serverReady },
  ];

  const missing =
    voiceover.provider === SERVER
      ? i18n.t(keys.server.protocol === 'openai' ? 'settings.noServer' : 'settings.voiceoverServerNeedsOpenai')
      : i18n.t('settings.noKeyFor', [KEY_PROVIDER_LABELS[voiceover.provider]]);

  return (
    <SettingsCard icon={AudioLines} title={i18n.t('settings.voiceover')} hint={i18n.t('settings.voiceoverHint')}>
      <div>
        <label className="block text-[11px] font-semibold text-foreground mb-1">{i18n.t('settings.provider')}</label>
        <ProviderSelect
          value={voiceover.provider}
          onChange={voiceover.setProvider}
          onOpenKeys={onOpenKeys}
          options={options}
        />
        {!voiceover.hasKey && <MissingKeyNote text={missing} onOpenKeys={onOpenKeys} />}
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-foreground mb-1">{i18n.t('settings.voice')}</label>
        {voiceover.provider === SERVER ? (
          <Input
            value={voiceover.voiceId}
            onChange={(e) => voiceover.setVoiceId(e.target.value)}
            placeholder={server.defaultVoice}
            aria-label={i18n.t('settings.voice')}
            className="h-8 text-[13px] rounded-lg border-border"
          />
        ) : (
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
        )}
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-foreground mb-1">{i18n.t('settings.model')}</label>
        {voiceover.provider === SERVER ? (
          <Input
            value={voiceover.modelId}
            onChange={(e) => voiceover.setModelId(e.target.value)}
            placeholder={server.defaultModel}
            aria-label={i18n.t('settings.model')}
            className="h-8 text-[13px] rounded-lg border-border"
          />
        ) : (
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
        )}
      </div>
    </SettingsCard>
  );
}
