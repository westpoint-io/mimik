// @vitest-environment jsdom

import { StepCard, TooltipProvider } from '@mimik/ui';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Step } from '@/core/guides/types';

vi.mock('@/core/guides/service', () => ({ replaceScreenshot: vi.fn() }));
vi.mock('@/core/screenshot/render', () => ({ imageDimensions: vi.fn(), renderScreenshot: vi.fn() }));

const step: Step = {
  id: 's1',
  guideId: 'g1',
  index: 0,
  description: 'Click the thing',
  action: 'click',
  url: 'https://a.test',
  timestamp: 1,
};

function renderCard() {
  const dragHandleProps = { onDragStart: vi.fn(), onDragOver: vi.fn(), onDragEnd: vi.fn() };
  const { container } = render(
    <TooltipProvider>
      <StepCard
        step={step}
        number={1}
        screenshot={undefined}
        dragHandleProps={dragHandleProps}
        onDescriptionChange={vi.fn()}
        onDelete={vi.fn()}
      />
    </TooltipProvider>,
  );
  const card = container.querySelector('[draggable="true"]') as HTMLElement;
  return { dragHandleProps, card, container };
}

describe('StepCard reordering', () => {
  it('does not start a drag when the press lands on the description', () => {
    const { dragHandleProps, card, container } = renderCard();
    fireEvent.pointerDown(container.querySelector('textarea') as HTMLElement);
    fireEvent.dragStart(card);
    expect(dragHandleProps.onDragStart).not.toHaveBeenCalled();
  });

  it('starts a drag when the press lands on the grip', () => {
    const { dragHandleProps, card, container } = renderCard();
    fireEvent.pointerDown(container.querySelector('[data-drag-handle]') as HTMLElement);
    fireEvent.dragStart(card);
    expect(dragHandleProps.onDragStart).toHaveBeenCalled();
  });
});
