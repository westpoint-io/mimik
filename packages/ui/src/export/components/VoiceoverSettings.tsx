import { KEY_PROVIDER_LABELS, SERVER } from '@mimik/core/capture/ai/keys';
import { i18n } from '@mimik/core/env';
import {
  VOICEOVER_PROVIDER_KEYS,
  VOICEOVER_PROVIDERS,
  type VoiceoverProviderKey,
  voiceoverProvider,
} from '@mimik/core/export/voiceover/providers';
import { AudioLines, Loader2, Play, Square } from 'lucide-react';
import { MissingKeyNote } from '../../ai/components/MissingKeyNote';
import { type ProviderOption, ProviderSelect } from '../../ai/components/ProviderSelect';
import type { ApiKeysState } from '../../ai/hooks/use-api-keys';
import { SettingsCard } from '../../common/components/SettingsCard';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useVoiceSample } from '../hooks/use-voice-sample';
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
  const sample = useVoiceSample(
    JSON.stringify([
      voiceover.provider,
      voiceover.voiceId,
      voiceover.modelId,
      keys.keys[voiceover.provider],
      keys.server,
    ]),
  );

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

      <div>
        <Button
          variant="outline"
          size="sm"
          disabled={!voiceover.hasKey || sample.status.state === 'loading'}
          onClick={() =>
            sample.status.state === 'playing' ? sample.stop() : void sample.test(i18n.t('settings.voiceSampleText'))
          }
          className="w-full rounded-lg bg-card text-[11px] font-semibold"
        >
          {sample.status.state === 'loading' ? (
            <Loader2 size={12} className="animate-spin" />
          ) : sample.status.state === 'playing' ? (
            <Square size={12} />
          ) : (
            <Play size={12} />
          )}
          {i18n.t(
            sample.status.state === 'loading'
              ? 'settings.voiceSampleLoading'
              : sample.status.state === 'playing'
                ? 'settings.voiceSampleStop'
                : 'settings.voiceSample',
          )}
        </Button>
        {sample.status.state === 'failed' && (
          <p className="mt-1 text-[11px] text-destructive break-words" role="alert">
            {i18n.t('settings.voiceSampleFailed', [sample.status.detail])}
          </p>
        )}
        {sample.status.state === 'failed' && sample.status.suspectVoice && (
          <p className="mt-1 text-[11px] text-muted-foreground">{i18n.t('settings.voiceSampleCheckVoice')}</p>
        )}
        {sample.status.state === 'unreadable' && (
          <p className="mt-1 text-[11px] text-destructive" role="alert">
            {i18n.t('settings.voiceSampleUnreadable')}
          </p>
        )}
      </div>
    </SettingsCard>
  );
}
