import { describe, expect, it } from 'vitest';
import { COVER_SEGMENT, MAX_SEGMENT_CHARS, narrationText, voiceoverScript } from '@/core/export/voiceover/script';
import type { Guide, Step } from '@/core/guides/types';

const guide = { id: 'g', title: 'Reset your password' } as Guide;

function step(id: string, description: string, blockType?: Step['blockType']): Step {
  return { id, description, blockType } as Step;
}

describe('narrationText', () => {
  it('collapses the whitespace a description picked up from the DOM', () => {
    expect(narrationText('  Click   the\n Save  button ')).toBe('Click the Save button');
  });

  it('is empty for a step nobody described', () => {
    expect(narrationText(undefined)).toBe('');
    expect(narrationText('   ')).toBe('');
  });

  it('truncates a runaway description at a sentence break so the clip stays bounded', () => {
    const text = `${'Open the settings panel. '.repeat(40)}end`;
    const spoken = narrationText(text);
    expect(spoken.length).toBeLessThanOrEqual(MAX_SEGMENT_CHARS);
    expect(spoken.endsWith('.')).toBe(true);
  });
});

describe('voiceoverScript', () => {
  const steps = [step('a', 'Click Save'), step('b', '  '), step('c', 'Heads up', 'callout')];

  it('opens with the guide title when the cover card is on', () => {
    expect(voiceoverScript(guide, steps, true)[0]).toEqual({ index: COVER_SEGMENT, text: 'Reset your password' });
  });

  it('leaves the cover unnarrated when the card is off', () => {
    expect(voiceoverScript(guide, steps, false).some((s) => s.index === COVER_SEGMENT)).toBe(false);
  });

  it('indexes segments by frame position, skipping the steps with nothing to say', () => {
    expect(voiceoverScript(guide, steps, false)).toEqual([
      { index: 0, text: 'Click Save' },
      { index: 2, text: 'Heads up' },
    ]);
  });
});
