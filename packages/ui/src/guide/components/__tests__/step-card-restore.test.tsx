// @vitest-environment jsdom

import type { Step } from '@mimik/core/guides/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '../../../components/ui/tooltip';

const restoreNarratedDescription = vi.fn();

vi.mock('@mimik/core/guides/service', () => ({
  replaceScreenshot: vi.fn(),
  restoreNarratedDescription: (...args: unknown[]) => restoreNarratedDescription(...args),
}));
vi.mock('@mimik/core/screenshot/render', () => ({ imageDimensions: vi.fn(), renderScreenshot: vi.fn() }));

import { StepCard } from '../StepCard';

const SPOKEN = 'Open the billing tab on the left';

function step(overrides: Partial<Step>): Step {
  return {
    id: 's1',
    guideId: 'g1',
    index: 0,
    description: SPOKEN,
    action: 'click',
    url: 'https://a.test',
    timestamp: 1,
    ...overrides,
  };
}

function renderCard(current: Step, readOnly = false, onChanged = vi.fn()) {
  return render(
    <TooltipProvider>
      <StepCard
        step={current}
        number={1}
        screenshot={undefined}
        readOnly={readOnly}
        onDescriptionChange={vi.fn()}
        onDelete={vi.fn()}
        onChanged={onChanged}
      />
    </TooltipProvider>,
  );
}

const restoreButton = () => screen.queryByRole('button', { name: 'editor.restoreSpoken' });

describe('restoring what the step said', () => {
  it('is offered once an edit has moved the text away from the narration', () => {
    renderCard(step({ description: 'Click Billing', narratedDescription: SPOKEN, descriptionSource: 'manual' }));
    expect(restoreButton()).toBeTruthy();
  });

  it('is not offered while the text still matches the narration', () => {
    renderCard(step({ description: SPOKEN, narratedDescription: SPOKEN, descriptionSource: 'narration' }));
    expect(restoreButton()).toBeNull();
  });

  it('is not offered on a step narration never touched', () => {
    renderCard(step({ description: 'Click Billing', descriptionSource: 'ai' }));
    expect(restoreButton()).toBeNull();
  });

  it('is not offered while the card is read-only', () => {
    renderCard(step({ description: 'Click Billing', narratedDescription: SPOKEN }), true);
    expect(restoreButton()).toBeNull();
  });

  it('is not offered while a description is still being written', () => {
    renderCard(step({ description: 'Click Billing', narratedDescription: SPOKEN, aiPending: true }));
    expect(restoreButton()).toBeNull();
  });

  it('puts the spoken text back and tells the page to reload', async () => {
    restoreNarratedDescription.mockResolvedValue(SPOKEN);
    const onChanged = vi.fn();
    renderCard(
      step({ description: 'Click Billing', narratedDescription: SPOKEN, descriptionSource: 'manual' }),
      false,
      onChanged,
    );

    const button = restoreButton();
    expect(button).toBeTruthy();
    fireEvent.click(button as HTMLElement);

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(restoreNarratedDescription).toHaveBeenCalledWith('s1');
    expect(screen.getByDisplayValue(SPOKEN)).toBeTruthy();
  });
});
