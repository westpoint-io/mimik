// @vitest-environment jsdom

import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../tooltip';

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

function renderMenu(withTooltip = false) {
  const trigger = (
    <DropdownMenuTrigger asChild>
      <button type="button">Edit</button>
    </DropdownMenuTrigger>
  );
  render(
    <TooltipProvider>
      <DropdownMenu>
        {withTooltip ? (
          <Tooltip>
            <TooltipTrigger asChild>{trigger}</TooltipTrigger>
            <TooltipContent>Edit screenshot</TooltipContent>
          </Tooltip>
        ) : (
          trigger
        )}
        <DropdownMenuContent>
          <DropdownMenuItem>Annotate</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <button type="button">Elsewhere</button>
    </TooltipProvider>,
  );
  const button = screen.getByRole('button', { name: 'Edit' });
  fireEvent.keyDown(button, { key: 'Enter' });
  expect(screen.getByRole('menu')).toBeTruthy();
  return button;
}

describe('DropdownMenu', () => {
  it('stays open when the browser moves focus back to its trigger', () => {
    const trigger = renderMenu();
    act(() => trigger.focus());
    expect(screen.queryByRole('menu')).toBeTruthy();
  });

  it('stays open when the trigger is also a tooltip trigger', () => {
    const trigger = renderMenu(true);
    act(() => trigger.focus());
    expect(screen.queryByRole('menu')).toBeTruthy();
  });

  it('closes when focus moves anywhere else', () => {
    renderMenu();
    act(() => screen.getByRole('button', { name: 'Elsewhere' }).focus());
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
