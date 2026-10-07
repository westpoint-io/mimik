// @vitest-environment jsdom

import type { Step } from '@mimik/core/guides/types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '../../../components/ui/tooltip';
import { StepCard } from '../StepCard';

vi.mock('@mimik/core/guides/service', () => ({ replaceScreenshot: vi.fn() }));
vi.mock('@mimik/core/screenshot/render', () => ({ imageDimensions: vi.fn(), renderScreenshot: vi.fn() }));

const step: Step = {
  id: 's1',
  guideId: 'g1',
  index: 0,
  description: 'Click the thing',
  action: 'click',
  url: 'https://a.test',
  timestamp: 1,
};

function renderCard(readOnly: boolean) {
  return render(
    <TooltipProvider>
      <StepCard
        step={step}
        number={1}
        screenshot={undefined}
        readOnly={readOnly}
        onDescriptionChange={vi.fn()}
        onDelete={vi.fn()}
        onChanged={vi.fn()}
      />
    </TooltipProvider>,
  );
}

describe('StepCard without a screenshot', () => {
  it('offers an upload when the step is editable', () => {
    renderCard(false);
    expect(screen.getByRole('button', { name: /screenshotView.addImage/ })).toBeTruthy();
  });

  it('offers no upload when the step is read-only', () => {
    renderCard(true);
    expect(screen.queryByRole('button', { name: /screenshotView.addImage/ })).toBeNull();
  });
});
