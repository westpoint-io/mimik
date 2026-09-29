import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PanelVoiceUpdate, VoicePhase } from '@/lib/port';
import { VOICE_CONFIRM_MS, voiceNotice, voiceSignature } from '../voice-notice';

const LOCALES = ['en', 'es', 'fr', 'pt-BR', 'zh-CN', 'ru'];

function update(phase: VoicePhase, extra: Partial<PanelVoiceUpdate> = {}): PanelVoiceUpdate {
  return { type: 'VOICE_UPDATE', phase, ...extra };
}

function localeKeys(locale: string): Set<string> {
  const keys = new Set<string>();
  let section = '';
  for (const line of readFileSync(join(process.cwd(), 'src/locales', `${locale}.yml`), 'utf8').split('\n')) {
    const top = /^([\w-]+):/.exec(line);
    if (top) {
      section = top[1];
      continue;
    }
    const nested = /^ {2}([\w-]+):/.exec(line);
    if (nested && section) keys.add(`${section}.${nested[1]}`);
  }
  return keys;
}

describe('voiceNotice', () => {
  it('explains that descriptions are still being written while transcription runs', () => {
    const notice = voiceNotice(update('transcribing'), true);
    expect(notice).toMatchObject({
      tone: 'progress',
      titleKey: 'voice.transcribing',
      bodyKey: 'voice.transcribingHint',
      autoDismissMs: null,
    });
  });

  it('announces transcription even before any live phase has been seen', () => {
    expect(voiceNotice(update('transcribing'), false)?.tone).toBe('progress');
  });

  it('says nothing while a recording is in progress', () => {
    expect(voiceNotice(update('recording'), true)).toBeNull();
  });

  it('reassures that the guide survived a narration failure', () => {
    const notice = voiceNotice(update('error', { reason: 'no-audio' }), true);
    expect(notice).toMatchObject({
      tone: 'failed',
      titleKey: 'voice.errorNoAudio',
      bodyKey: 'voice.guideSafe',
      showSettings: false,
      autoDismissMs: null,
    });
  });

  it('offers settings only when the key is the thing that is missing', () => {
    expect(voiceNotice(update('error', { reason: 'missing-api-key' }), true)?.showSettings).toBe(true);
    expect(voiceNotice(update('error', { reason: 'permission-denied' }), true)?.showSettings).toBe(false);
  });

  it('falls back to the unknown failure message when no reason came through', () => {
    expect(voiceNotice(update('error'), true)?.titleKey).toBe('voice.errorUnknown');
  });

  it('attributes the rewritten descriptions to a step count and then gets out of the way', () => {
    const notice = voiceNotice(update('idle', { narrated: 4 }), true);
    expect(notice).toMatchObject({
      tone: 'done',
      titleKey: 'voice.narratedPlural',
      titleSubstitutions: ['4'],
      autoDismissMs: VOICE_CONFIRM_MS,
    });
  });

  it('counts a single narrated step without pluralising', () => {
    expect(voiceNotice(update('idle', { narrated: 1 }), true)?.titleKey).toBe('voice.narrated');
  });

  it('states plainly when nothing matched, with no count to substitute', () => {
    const notice = voiceNotice(update('idle', { narrated: 0 }), true);
    expect(notice?.titleKey).toBe('voice.narratedNone');
    expect(notice?.titleSubstitutions).toBeUndefined();
  });

  it('withholds a result the user never watched arrive', () => {
    expect(voiceNotice(update('idle', { narrated: 4 }), false)).toBeNull();
  });

  it('stays silent on a plain idle phase', () => {
    expect(voiceNotice(update('idle'), true)).toBeNull();
  });
});

describe('voiceSignature', () => {
  it('is stable for repeats of the same update so a dismissal sticks', () => {
    expect(voiceSignature(update('idle', { narrated: 2 }))).toBe(voiceSignature(update('idle', { narrated: 2 })));
  });

  it('changes when the phase, the reason or the count changes', () => {
    const signatures = new Set([
      voiceSignature(update('transcribing')),
      voiceSignature(update('error', { reason: 'no-audio' })),
      voiceSignature(update('error', { reason: 'missing-api-key' })),
      voiceSignature(update('idle', { narrated: 2 })),
      voiceSignature(update('idle', { narrated: 3 })),
    ]);
    expect(signatures.size).toBe(5);
  });
});

describe('locale coverage', () => {
  const emitted = [
    ...(['transcribing', 'recording', 'idle'] as VoicePhase[]).flatMap((phase) => [
      voiceNotice(update(phase), true),
      voiceNotice(update(phase, { narrated: 0 }), true),
      voiceNotice(update(phase, { narrated: 2 }), true),
    ]),
    voiceNotice(update('error'), true),
    voiceNotice(update('error', { reason: 'missing-api-key' }), true),
  ]
    .filter((notice) => notice !== null)
    .flatMap((notice) => [notice.titleKey, notice.bodyKey, notice.showSettings ? 'voice.openSettings' : undefined])
    .filter((key) => key !== undefined);

  it('renders more than one message', () => {
    expect(emitted.length).toBeGreaterThan(3);
  });

  it.each(LOCALES)('%s defines every message the notice can show', (locale) => {
    const keys = localeKeys(locale);
    for (const key of [...emitted, 'common.close']) expect([...keys]).toContain(key);
  });
});
