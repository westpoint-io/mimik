import { beforeEach, describe, expect, it } from 'vitest';
import { recordNarrated, takeNarrated } from '../voice';

describe('narration tally', () => {
  beforeEach(() => {
    takeNarrated('g1');
    takeNarrated('g2');
  });

  it('counts the steps narrated while the recording was still running', () => {
    recordNarrated('g1', ['s1']);
    recordNarrated('g1', ['s2']);

    expect(takeNarrated('g1')).toEqual(['s1', 's2']);
  });

  it('counts a step once when it is narrated again at the end', () => {
    recordNarrated('g1', ['s1', 's2']);
    recordNarrated('g1', ['s2']);

    expect(takeNarrated('g1')).toEqual(['s1', 's2']);
  });

  it('reports nothing for a recording where no step was narrated', () => {
    expect(takeNarrated('g1')).toEqual([]);
  });

  it('keeps each recording separate', () => {
    recordNarrated('g1', ['s1']);
    recordNarrated('g2', ['s9']);

    expect(takeNarrated('g1')).toEqual(['s1']);
    expect(takeNarrated('g2')).toEqual(['s9']);
  });

  it('starts over once a recording has been reported', () => {
    recordNarrated('g1', ['s1']);
    takeNarrated('g1');

    expect(takeNarrated('g1')).toEqual([]);
  });
});
