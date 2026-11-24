// @vitest-environment jsdom

import type { Step } from '@mimik/core/guides/types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '../../../components/ui/tooltip';

vi.mock('@mimik/core/guides/service', () => ({ replaceScreenshot: vi.fn(), restoreNarratedDescription: vi.fn() }));
vi.mock('@mimik/core/screenshot/render', () => ({ imageDimensions: vi.fn(), renderScreenshot: vi.fn() }));

import { StepCard } from '../StepCard';

function renderCard(overrides: Partial<Step>) {
  const step: Step = {
    id: 's1',
    guideId: 'g1',
    index: 0,
    description: 'Click Save',
    action: 'click',
    url: 'https://a.test',
    timestamp: 1,
    ...overrides,
  };
  return render(
    <TooltipProvider>
      <StepCard
        step={step}
        number={1}
        screenshot={undefined}
        onDescriptionChange={vi.fn()}
        onDelete={vi.fn()}
        onChanged={vi.fn()}
      />
    </TooltipProvider>,
  );
}

describe('a click the page may not have received', () => {
  it('says so on the step', () => {
    renderCard({ replayUnconfirmed: true });
    expect(screen.getByText('editor.replayUnconfirmed')).toBeTruthy();
  });

  it('says nothing on an ordinary step', () => {
    renderCard({});
    expect(screen.queryByText('editor.replayUnconfirmed')).toBeNull();
  });
});
