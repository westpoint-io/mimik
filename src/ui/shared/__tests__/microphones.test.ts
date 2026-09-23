import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isMicrophoneMissing,
  type MicrophoneOption,
  microphoneListState,
  microphoneStatus,
  nextMicLevel,
  SPEAKING_LEVEL,
  SYSTEM_DEFAULT_VALUE,
  toMicrophoneOptions,
  toSelectValue,
  toStoredMicrophoneId,
} from '../microphones';

const LOCALES = ['en', 'de', 'es', 'fr', 'pt-BR', 'zh-CN', 'ru'];

const MICROPHONE_KEYS = [
  'settings.microphone',
  'settings.microphoneDefault',
  'settings.microphoneNeedsAccess',
  'settings.microphoneGrantAccess',
  'settings.microphoneNone',
  'settings.microphoneUnavailable',
  'settings.microphoneMissing',
  'settings.microphoneTest',
  'settings.microphoneTestStop',
  'settings.microphoneTestFailed',
  'settings.microphoneUnblockHow',
  'settings.microphoneStatusAllowed',
  'settings.microphoneStatusBlocked',
  'settings.microphoneStatusPending',
  'settings.microphoneBlocked',
  'micPermission.retry',
  'voice.micHearing',
  'voice.micQuiet',
];

function device(kind: MediaDeviceKind, deviceId: string, label: string) {
  return { kind, deviceId, label };
}

function option(deviceId: string, label: string): MicrophoneOption {
  return { deviceId, label };
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

describe('toMicrophoneOptions', () => {
  it('keeps only audio inputs', () => {
    const options = toMicrophoneOptions([
      device('audioinput', 'mic-1', 'Built-in Microphone'),
      device('audiooutput', 'speaker-1', 'Built-in Output'),
      device('videoinput', 'cam-1', 'FaceTime HD Camera'),
    ]);
    expect(options).toEqual([option('mic-1', 'Built-in Microphone')]);
  });

  it('drops the aliases the system default option already covers', () => {
    const options = toMicrophoneOptions([
      device('audioinput', 'default', 'Default - Headset'),
      device('audioinput', 'communications', 'Communications - Headset'),
      device('audioinput', 'mic-1', 'Headset'),
    ]);
    expect(options).toEqual([option('mic-1', 'Headset')]);
  });

  it('drops devices without an id and repeated ids', () => {
    const options = toMicrophoneOptions([
      device('audioinput', '', 'Nameless'),
      device('audioinput', 'mic-1', 'Headset'),
      device('audioinput', 'mic-1', 'Headset'),
    ]);
    expect(options).toEqual([option('mic-1', 'Headset')]);
  });

  it('keeps the blank labels the browser reports before permission is granted', () => {
    expect(toMicrophoneOptions([device('audioinput', 'mic-1', '')])).toEqual([option('mic-1', '')]);
  });
});

describe('microphoneListState', () => {
  it('reports no devices when nothing is plugged in', () => {
    expect(microphoneListState([])).toBe('no-devices');
  });

  it('reports no devices when only outputs and cameras are present', () => {
    expect(microphoneListState([device('audiooutput', 'speaker-1', 'Speakers')])).toBe('no-devices');
  });

  it('reports unlabelled for the blank placeholder Chrome returns before permission', () => {
    expect(microphoneListState([device('audioinput', '', '')])).toBe('unlabelled');
  });

  it('reports unlabelled when ids are exposed but names are withheld', () => {
    expect(microphoneListState([device('audioinput', 'mic-1', ''), device('audioinput', 'mic-2', '')])).toBe(
      'unlabelled',
    );
  });

  it('reports unlabelled when even one name is missing', () => {
    expect(microphoneListState([device('audioinput', 'mic-1', 'Headset'), device('audioinput', 'mic-2', '')])).toBe(
      'unlabelled',
    );
  });

  it('reports ready once every input has an id and a name', () => {
    expect(microphoneListState([device('audioinput', 'mic-1', 'Headset'), device('audiooutput', '', '')])).toBe(
      'ready',
    );
  });
});

describe('microphoneStatus', () => {
  it('separates a blocked microphone from one that was never asked for', () => {
    expect(microphoneStatus('denied', 'unlabelled')).toBe('blocked');
    expect(microphoneStatus('prompt', 'unlabelled')).toBe('pending');
  });

  it('reports blocked even when no device is plugged in', () => {
    expect(microphoneStatus('denied', 'no-devices')).toBe('blocked');
  });

  it('reports allowed once the browser grants access', () => {
    expect(microphoneStatus('granted', 'unlabelled')).toBe('allowed');
  });

  it('falls back to the device labels when permissions cannot be queried', () => {
    expect(microphoneStatus('unknown', 'ready')).toBe('allowed');
    expect(microphoneStatus('unknown', 'unlabelled')).toBe('pending');
  });
});

describe('select value round trip', () => {
  it('shows the system default option for the empty stored id', () => {
    expect(toSelectValue('')).toBe(SYSTEM_DEFAULT_VALUE);
    expect(toSelectValue('   ')).toBe(SYSTEM_DEFAULT_VALUE);
  });

  it('shows the stored device id when one is chosen', () => {
    expect(toSelectValue('mic-1')).toBe('mic-1');
  });

  it('stores the empty string the voice host reads as system default', () => {
    expect(toStoredMicrophoneId(SYSTEM_DEFAULT_VALUE)).toBe('');
  });

  it('stores the device id for a real choice', () => {
    expect(toStoredMicrophoneId('mic-1')).toBe('mic-1');
  });

  it('never produces the empty value Radix rejects for an item', () => {
    expect(toSelectValue(toStoredMicrophoneId(SYSTEM_DEFAULT_VALUE))).toBe(SYSTEM_DEFAULT_VALUE);
  });
});

describe('isMicrophoneMissing', () => {
  it('treats system default as always present', () => {
    expect(isMicrophoneMissing('', [])).toBe(false);
  });

  it('finds the stored device in the current list', () => {
    expect(isMicrophoneMissing('mic-1', [option('mic-1', 'Headset')])).toBe(false);
  });

  it('flags a stored device that has been unplugged', () => {
    expect(isMicrophoneMissing('mic-1', [option('mic-2', 'Built-in')])).toBe(true);
  });
});

describe('nextMicLevel', () => {
  it('floors silence at zero', () => {
    expect(nextMicLevel(0, 0)).toBe(0);
  });

  it('clamps a hot signal to one', () => {
    expect(nextMicLevel(4, 1)).toBe(1);
  });

  it('smooths towards the new reading instead of jumping', () => {
    const level = nextMicLevel(1, 0);
    expect(level).toBeGreaterThan(0);
    expect(level).toBeLessThan(1);
  });

  it('crosses the speaking threshold for speech and not for room noise', () => {
    const speech = 10 ** (-30 / 20);
    const noise = 10 ** (-55 / 20);
    let speaking = 0;
    let quiet = 0;
    for (let i = 0; i < 20; i += 1) {
      speaking = nextMicLevel(speech, speaking);
      quiet = nextMicLevel(noise, quiet);
    }
    expect(speaking).toBeGreaterThan(SPEAKING_LEVEL);
    expect(quiet).toBeLessThan(SPEAKING_LEVEL);
  });
});

describe('microphone picker copy', () => {
  it.each(LOCALES)('%s carries every key the picker renders', (locale) => {
    const keys = localeKeys(locale);
    for (const key of MICROPHONE_KEYS) expect(keys).toContain(key);
  });
});
