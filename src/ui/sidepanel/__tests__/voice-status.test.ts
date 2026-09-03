import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { VoiceErrorReason } from '@/lib/voice-messages';
import {
  LEVEL_STALE_MS,
  MIC_ACTIVITIES,
  MIC_BAR_MIN_SCALE,
  MIC_BARS,
  micActivity,
  micActivityKey,
  micBarScale,
  narratedKey,
  SPEAKING_HOLD_MS,
  voiceErrorKey,
} from '../voice-status';

const LOCALES = ['en', 'es', 'fr', 'pt-BR'];

function voiceKeysIn(locale: string): string[] {
  const lines = readFileSync(join(process.cwd(), 'src/locales', `${locale}.yml`), 'utf8')
    .replace(/\r\n/g, '\n')
    .split('\n');
  const start = lines.indexOf('voice:');
  const keys: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '') continue;
    if (!line.startsWith('  ')) break;
    const match = /^ {2}([\w-]+):/.exec(line);
    if (match) keys.push(`voice.${match[1]}`);
  }
  return keys;
}

const ALL_REASONS: VoiceErrorReason[] = [
  'permission-denied',
  'no-device',
  'no-audio',
  'not-recording',
  'already-recording',
  'missing-api-key',
  'stream-ended',
  'unsupported',
  'unknown',
];

describe('voiceErrorKey', () => {
  it('gives every reason its own message', () => {
    const keys = ALL_REASONS.map(voiceErrorKey);
    expect(new Set(keys).size).toBe(ALL_REASONS.length);
  });

  it('points a missing transcription key at settings', () => {
    expect(voiceErrorKey('missing-api-key')).toBe('voice.errorMissingApiKey');
  });

  it('falls back to the unknown message for an absent or unrecognised reason', () => {
    expect(voiceErrorKey(undefined)).toBe('voice.errorUnknown');
    expect(voiceErrorKey('teleported-away' as VoiceErrorReason)).toBe('voice.errorUnknown');
  });
});

describe('micActivity', () => {
  it('waits until the first level arrives', () => {
    expect(micActivity(null, null, 1000)).toBe('waiting');
  });

  it('reports speaking while the hold window is open', () => {
    expect(micActivity(1000, 1000, 1000 + SPEAKING_HOLD_MS)).toBe('speaking');
  });

  it('falls back to quiet once the hold window closes', () => {
    expect(micActivity(1000, 1000, 1000 + SPEAKING_HOLD_MS + 1)).toBe('quiet');
  });

  it('stays quiet when levels arrive but nothing is spoken', () => {
    expect(micActivity(2000, null, 2000)).toBe('quiet');
  });

  it('holds through a pause shorter than the level feed interval', () => {
    expect(SPEAKING_HOLD_MS).toBeLessThan(LEVEL_STALE_MS * 2);
  });
});

describe('micBarScale', () => {
  it('never collapses a bar to nothing and never overshoots', () => {
    for (const bar of MIC_BARS) {
      for (const level of [-1, 0, 0.5, 1, 2, Number.NaN]) {
        const scale = micBarScale(level, bar.weight);
        expect(scale).toBeGreaterThanOrEqual(MIC_BAR_MIN_SCALE);
        expect(scale).toBeLessThanOrEqual(1);
      }
    }
  });

  it('grows with the level', () => {
    expect(micBarScale(0.8, 1)).toBeGreaterThan(micBarScale(0.2, 1));
  });

  it('keeps the outer bars shorter than the centre one', () => {
    expect(micBarScale(1, MIC_BARS[0].weight)).toBeLessThan(micBarScale(1, MIC_BARS[2].weight));
  });
});

describe('narratedKey', () => {
  it('distinguishes none, one and many', () => {
    expect(narratedKey(0)).toBe('voice.narratedNone');
    expect(narratedKey(1)).toBe('voice.narrated');
    expect(narratedKey(4)).toBe('voice.narratedPlural');
  });
});

describe('locale coverage', () => {
  const emitted = [
    ...ALL_REASONS.map(voiceErrorKey),
    ...MIC_ACTIVITIES.map(micActivityKey),
    ...[0, 1, 5].map(narratedKey),
  ];

  it('en defines every key the mappings can emit', () => {
    const keys = voiceKeysIn('en');
    for (const key of emitted) expect(keys).toContain(key);
  });

  it('every locale carries the same voice keys', () => {
    const reference = voiceKeysIn('en');
    expect(reference.length).toBeGreaterThan(0);
    for (const locale of LOCALES) expect(voiceKeysIn(locale).sort()).toEqual([...reference].sort());
  });
});
