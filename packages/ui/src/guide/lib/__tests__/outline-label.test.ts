import type { Step } from '@mimik/core/guides/types';
import { describe, expect, it } from 'vitest';
import { outlineLabel } from '../outline-label';

const step = (extra: Partial<Step>): Step => ({
  id: 's',
  guideId: 'g',
  index: 0,
  description: '',
  action: 'click',
  url: 'https://a.test',
  timestamp: 1,
  ...extra,
});

describe('outlineLabel', () => {
  it('uses the description', () => {
    expect(outlineLabel(step({ description: ' Click Save ' }))).toBe('Click Save');
  });
  it('says the description is being written while AI is pending', () => {
    expect(outlineLabel(step({ description: 'Click', aiPending: true }))).toBe('editor.writingStepDescription');
  });
  it('falls back to untitled for an empty step', () => {
    expect(outlineLabel(step({}))).toBe('outline.untitledStep');
  });
  it('uses the block placeholders for empty blocks', () => {
    expect(outlineLabel(step({ blockType: 'heading' }))).toBe('blocks.headingPlaceholder');
    expect(outlineLabel(step({ blockType: 'callout' }))).toBe('blocks.calloutPlaceholder');
  });
});
