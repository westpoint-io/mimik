// @vitest-environment jsdom

import { reorderSteps } from '@mimik/core/guides/service';
import type { Step } from '@mimik/core/guides/types';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFullviewStore } from '../../../stores/fullview';
import { GuideOutline } from '../GuideOutline';

vi.mock('@mimik/core/guides/service', () => ({ reorderSteps: vi.fn(async () => {}) }));

const make = (id: string, extra: Partial<Step> = {}): Step => ({
  id,
  guideId: 'g1',
  index: 0,
  description: `Step ${id}`,
  action: 'click',
  url: 'https://a.test',
  timestamp: 1,
  ...extra,
});

const steps = [
  make('a'),
  make('h', { blockType: 'heading', description: 'Setup' }),
  make('b'),
  make('n', { blockType: 'callout', description: 'Careful' }),
  make('c'),
];

const row = (id: string) => document.querySelector(`[data-step-id="${id}"]`) as HTMLElement;

function renderOutline(props: Partial<React.ComponentProps<typeof GuideOutline>> = {}) {
  const onReorder = vi.fn();
  render(<GuideOutline guideId="g1" steps={steps} readOnly={false} wide onReorder={onReorder} {...props} />);
  return { onReorder };
}

function stubRects() {
  const ids = steps.map((step) => step.id);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const i = Math.max(0, ids.indexOf(this.getAttribute('data-step-id') ?? ''));
    return {
      x: 0,
      y: i * 40,
      top: i * 40,
      left: 0,
      width: 200,
      height: 36,
      right: 200,
      bottom: i * 40 + 36,
      toJSON: () => ({}),
    } as DOMRect;
  });
}

async function press(code: string, key: string) {
  await act(async () => {
    fireEvent.keyDown(document.activeElement ?? document.body, { code, key });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  vi.mocked(reorderSteps).mockClear();
  useFullviewStore.setState({
    outlineCollapsed: false,
    outlineDrawerOpen: false,
    selectedStepIds: new Set(),
    selectionAnchorId: null,
    scrollToStepId: null,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GuideOutline', () => {
  it('numbers only the action steps', () => {
    renderOutline();
    expect(row('a').textContent).toBe('1Step a');
    expect(row('b').textContent).toBe('2Step b');
    expect(row('c').textContent).toBe('3Step c');
    expect(row('h').textContent).toBe('Setup');
    expect(row('n').textContent).toBe('Careful');
  });

  it('jumps to a step on click', () => {
    renderOutline();
    fireEvent.click(row('b'));
    expect(useFullviewStore.getState().scrollToStepId).toBe('b');
  });

  it('shares a shift-click range with the editor selection', () => {
    renderOutline();
    fireEvent.click(row('a'), { ctrlKey: true });
    fireEvent.click(row('b'), { shiftKey: true });
    expect([...useFullviewStore.getState().selectedStepIds]).toEqual(['a', 'h', 'b']);
    expect(useFullviewStore.getState().scrollToStepId).toBeNull();
    expect(row('a').querySelector('[aria-label="outline.selected"]')).not.toBeNull();
    expect(row('c').querySelector('[aria-label="outline.selected"]')).toBeNull();
  });

  it('cannot drag or select while read-only, but rows stay available', async () => {
    stubRects();
    renderOutline({ readOnly: true });
    expect(row('a')).toHaveAttribute('aria-disabled', 'false');
    fireEvent.click(row('a'), { ctrlKey: true });
    expect(useFullviewStore.getState().selectedStepIds.size).toBe(0);
    row('a').focus();
    await press('Space', ' ');
    await press('ArrowDown', 'ArrowDown');
    await press('Space', ' ');
    expect(reorderSteps).not.toHaveBeenCalled();
  });

  it('renders nothing when collapsed on a wide window', () => {
    useFullviewStore.setState({ outlineCollapsed: true });
    renderOutline();
    expect(row('a')).toBeNull();
  });

  it('closes the drawer after jumping to a step on a narrow window', () => {
    useFullviewStore.setState({ outlineDrawerOpen: true });
    renderOutline({ wide: false });
    expect(row('a')).not.toBeNull();
    fireEvent.click(row('b'));
    expect(useFullviewStore.getState().scrollToStepId).toBe('b');
    expect(useFullviewStore.getState().outlineDrawerOpen).toBe(false);
  });

  it('reorders with the keyboard', async () => {
    stubRects();
    const { onReorder } = renderOutline();
    row('a').focus();
    await press('Space', ' ');
    await press('ArrowDown', 'ArrowDown');
    await press('Space', ' ');
    expect(reorderSteps).toHaveBeenCalledWith('g1', ['h', 'a', 'b', 'n', 'c']);
    expect(onReorder.mock.calls[0]?.[0].map((step: Step) => step.id)).toEqual(['h', 'a', 'b', 'n', 'c']);
  });

  it('ignores Enter while a row is being dragged in the drawer', async () => {
    stubRects();
    useFullviewStore.setState({ outlineDrawerOpen: true });
    renderOutline({ wide: false });
    row('a').focus();
    await press('Space', ' ');
    await press('Enter', 'Enter');
    expect(useFullviewStore.getState().scrollToStepId).toBeNull();
    expect(useFullviewStore.getState().outlineDrawerOpen).toBe(true);
    await press('Escape', 'Escape');
    expect(useFullviewStore.getState().outlineDrawerOpen).toBe(true);
  });

  it('moves the whole selection when a selected row is dragged', async () => {
    stubRects();
    renderOutline();
    fireEvent.click(row('a'), { ctrlKey: true });
    fireEvent.click(row('b'), { ctrlKey: true });
    row('a').focus();
    await press('Space', ' ');
    for (let i = 0; i < 4; i++) await press('ArrowDown', 'ArrowDown');
    await press('Space', ' ');
    expect(reorderSteps).toHaveBeenCalledWith('g1', ['h', 'n', 'c', 'a', 'b']);
  });
});
