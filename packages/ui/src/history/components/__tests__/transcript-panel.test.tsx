// @vitest-environment jsdom

import type { GuideTranscript, Step } from '@mimik/core/guides/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '../../../components/ui/tooltip';

const getTranscripts = vi.fn();
const addTranscriptLineToStep = vi.fn();
const deleteTranscripts = vi.fn();

vi.mock('@mimik/core/guides/service', () => ({
  getTranscripts: (...args: unknown[]) => getTranscripts(...args),
  addTranscriptLineToStep: (...args: unknown[]) => addTranscriptLineToStep(...args),
  deleteTranscripts: (...args: unknown[]) => deleteTranscripts(...args),
}));

import { TranscriptPanel } from '../TranscriptPanel';

const EPOCH = 1_700_000_000_000;

function step(id: string, index: number): Step {
  return {
    id,
    guideId: 'g1',
    index,
    description: 'Clicked something',
    action: 'click',
    url: 'https://a.test',
    timestamp: 1,
  };
}

function transcript(lines: Array<[number, string, string | null, string | null]>): GuideTranscript {
  return {
    id: 't1',
    guideId: 'g1',
    epochMs: EPOCH,
    createdAt: 1,
    lines: lines.map(([start, text, stepId, rejectReason]) => ({
      start,
      end: start + 1,
      text,
      stepId,
      rejectReason,
    })),
  };
}

function renderPanel(rows: GuideTranscript[], steps: Step[], readOnly = false) {
  getTranscripts.mockResolvedValue(rows);
  return render(
    <TooltipProvider>
      <TranscriptPanel
        guideId="g1"
        guideTitle="Test Guide"
        steps={steps}
        readOnly={readOnly}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />
    </TooltipProvider>,
  );
}

beforeEach(() => {
  getTranscripts.mockReset();
  addTranscriptLineToStep.mockReset();
  deleteTranscripts.mockReset();
});

describe('TranscriptPanel', () => {
  it('marks a line whose step was deleted as unused and offers it to a live step', async () => {
    renderPanel(
      [
        transcript([
          [1, 'first line', 's1', null],
          [3, 'orphaned line', 'gone', null],
          [5, 'third line', 's3', null],
        ]),
      ],
      [step('s1', 0), step('s3', 1)],
    );

    await screen.findByText('orphaned line');
    expect(screen.getByText('transcript.filterUnused[1]')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'transcript.addToStep[2]' })).toBeTruthy();
  });

  it('appends an unused line to the step that follows it', async () => {
    addTranscriptLineToStep.mockResolvedValue('Clicked something and then some');
    renderPanel(
      [
        transcript([
          [1, 'click save', 's1', null],
          [3, 'stray thought', null, null],
          [5, 'now the dialog', 's3', null],
        ]),
      ],
      [step('s1', 0), step('s3', 1)],
    );

    fireEvent.click(await screen.findByRole('button', { name: 'transcript.addToStep[2]' }));

    await waitFor(() =>
      expect(addTranscriptLineToStep).toHaveBeenCalledWith(expect.any(String), 1, 's3', 'stray thought'),
    );
  });

  it('records the attribution, so reopening cannot append the same line twice', async () => {
    addTranscriptLineToStep.mockResolvedValue('Clicked something and then some');
    const seeded = transcript([
      [1, 'click save', 's1', null],
      [3, 'stray thought', null, null],
      [5, 'now the dialog', 's3', null],
    ]);
    const attached = {
      ...seeded,
      lines: seeded.lines.map((l, i) => (i === 1 ? { ...l, stepId: 's3' } : l)),
    };
    getTranscripts.mockResolvedValueOnce([seeded]).mockResolvedValue([attached]);

    render(
      <TooltipProvider>
        <TranscriptPanel
          guideId="g1"
          guideTitle="Test Guide"
          steps={[step('s1', 0), step('s3', 1)]}
          onClose={vi.fn()}
          onChanged={vi.fn()}
        />
      </TooltipProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'transcript.addToStep[2]' }));

    await waitFor(() => expect(addTranscriptLineToStep).toHaveBeenCalledWith(seeded.id, 1, 's3', 'stray thought'));
    await waitFor(() => expect(screen.queryByRole('button', { name: /transcript.addToStep/ })).toBeNull());
    expect(addTranscriptLineToStep).toHaveBeenCalledTimes(1);
  });

  it('keeps a filtered line visible with its own tag', async () => {
    renderPanel([transcript([[1, 'Thanks for watching', null, 'blocklist:thanks for watching']])], [step('s1', 0)]);

    await screen.findByText('Thanks for watching');
    expect(screen.getByText('transcript.filteredOut')).toBeTruthy();
  });

  it('says so when nothing was narrated', async () => {
    renderPanel([], [step('s1', 0)]);
    expect(await screen.findByText('transcript.empty')).toBeTruthy();
  });

  it('does not offer the irreversible delete while the guide is read-only', async () => {
    renderPanel([transcript([[1, 'a line', 's1', null]])], [step('s1', 0)], true);

    await screen.findByText('a line');
    expect(screen.queryByRole('button', { name: 'transcript.delete' })).toBeNull();
    expect(screen.queryByRole('button', { name: /transcript.addToStep/ })).toBeNull();
  });

  it('says why there is no way to add a line while read-only', async () => {
    renderPanel(
      [
        transcript([
          [1, 'click save', 's1', null],
          [3, 'stray thought', null, null],
        ]),
      ],
      [step('s1', 0)],
      true,
    );

    expect(await screen.findByText('transcript.readOnlyHint')).toBeTruthy();
  });

  it('stays quiet about editing when every line is already used', async () => {
    renderPanel([transcript([[1, 'click save', 's1', null]])], [step('s1', 0)], true);

    await screen.findByText('click save');
    expect(screen.queryByText('transcript.readOnlyHint')).toBeNull();
  });
});
