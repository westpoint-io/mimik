// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DuplicateMenu } from '../DuplicateMenu';

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function openMenu() {
  const onDuplicate = vi.fn();
  render(
    <DuplicateMenu belowStep={3} aboveStep={2} lastStep={5} onDuplicate={onDuplicate}>
      <button type="button">open</button>
    </DuplicateMenu>,
  );
  fireEvent.click(screen.getByText('open'));
  return onDuplicate;
}

describe('DuplicateMenu', () => {
  it('duplicates below or above in one click', () => {
    const onDuplicate = openMenu();
    fireEvent.click(screen.getByText('editor.duplicateAbove'));
    expect(onDuplicate).toHaveBeenCalledWith('above');
  });

  it('sends the step number typed in, and refuses one past the end of the guide', () => {
    const onDuplicate = openMenu();
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '6' } });
    expect(screen.getByText('editor.duplicateGo')).toBeDisabled();
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.click(screen.getByText('editor.duplicateGo'));
    expect(onDuplicate).toHaveBeenCalledWith({ step: 5 });
  });
});
