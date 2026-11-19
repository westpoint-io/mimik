// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import type { PromptSection } from '@mimik/core/capture/ai/custom-prompts';
import { localStorage } from '@mimik/core/env';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiPromptsDialog } from '../AiPromptsDialog';

function setup(section: PromptSection = 'steps') {
  const onSaved = vi.fn();
  const onSectionChange = vi.fn();
  render(
    <AiPromptsDialog open section={section} onSectionChange={onSectionChange} onClose={vi.fn()} onSaved={onSaved} />,
  );
  return { onSaved, onSectionChange };
}

async function promptBox() {
  const box = screen.getByLabelText('settings.aiPromptLabel') as HTMLTextAreaElement;
  await waitFor(() => expect(box.value).toContain('You are describing steps'));
  return box;
}

describe('AiPromptsDialog', () => {
  beforeEach(async () => {
    await localStorage.set({ aiPrompts: {} });
  });

  it('opens on the section it is given', async () => {
    setup('guide');
    const box = screen.getByLabelText('settings.aiPromptLabel') as HTMLTextAreaElement;
    await waitFor(() => expect(box.value).toContain('TITLE:'));
    expect(screen.getByRole('tab', { name: 'settings.aiForGuide' })).toHaveAttribute('aria-selected', 'true');
  });

  it('asks for the other section when its tab is chosen', async () => {
    const { onSectionChange } = setup();
    await promptBox();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'settings.aiForGuide' }));
    expect(onSectionChange).toHaveBeenCalledWith('guide');
  });

  it('associates the panel with the selected tab', async () => {
    setup();
    await promptBox();
    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      screen.getByRole('tab', { selected: true }).id,
    );
  });

  it('hides the label and disables reset until the prompts load', async () => {
    setup();
    expect(screen.queryByText('settings.aiPromptDefault')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'settings.aiPromptReset' })).toBeDisabled();
    expect(await screen.findByText('settings.aiPromptDefault')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'settings.aiPromptReset' })).toBeEnabled();
  });

  it('marks an edit and restores the default on reset', async () => {
    setup();
    const box = await promptBox();
    fireEvent.change(box, { target: { value: 'Own prompt' } });
    expect(screen.getByText('settings.aiPromptEdited')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'settings.aiPromptReset' }));
    expect(screen.getByText('settings.aiPromptDefault')).toBeInTheDocument();
  });

  it('disables Save for an empty prompt', async () => {
    setup();
    fireEvent.change(await promptBox(), { target: { value: '  ' } });
    expect(screen.getByRole('button', { name: 'common.save' })).toBeDisabled();
  });

  it('saves the instructions', async () => {
    const { onSaved } = setup();
    await promptBox();
    fireEvent.change(screen.getByLabelText(/settings.aiInstructionsLabel/), { target: { value: 'Be brief.' } });
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ steps: { instructions: 'Be brief.' } }, null));
  });
});
