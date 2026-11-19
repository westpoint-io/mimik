// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { localStorage } from '@mimik/core/env';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiPromptsRow } from '../AiPromptsRow';

const props = { onLanguageChange: vi.fn() };

describe('AiPromptsRow', () => {
  beforeEach(async () => {
    await localStorage.set({ aiPrompts: {} });
  });

  it('opens the dialog when the surface has no other place for it', () => {
    render(<AiPromptsRow {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'editor.edit: settings.aiForSteps' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('opens the dialog on the section whose Edit was clicked', async () => {
    render(<AiPromptsRow {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'editor.edit: settings.aiForGuide' }));
    const box = screen.getByLabelText('settings.aiPromptLabel') as HTMLTextAreaElement;
    await waitFor(() => expect(box.value).toContain('TITLE:'));
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'settings.aiForSteps' }));
    expect((screen.getByLabelText('settings.aiPromptLabel') as HTMLTextAreaElement).value).toContain(
      'You are describing steps',
    );
  });

  it('calls onEditPrompts instead of opening the dialog in the side panel', () => {
    const onEditPrompts = vi.fn();
    render(<AiPromptsRow {...props} onEditPrompts={onEditPrompts} />);
    fireEvent.click(screen.getByRole('button', { name: 'editor.edit: settings.aiForGuide' }));
    expect(onEditPrompts).toHaveBeenCalledWith('guide');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the dialog on a section another surface asked for', async () => {
    const onPromptsRequestHandled = vi.fn();
    render(<AiPromptsRow {...props} promptsRequest="guide" onPromptsRequestHandled={onPromptsRequestHandled} />);
    const box = (await screen.findByLabelText('settings.aiPromptLabel')) as HTMLTextAreaElement;
    await waitFor(() => expect(box.value).toContain('TITLE:'));
    expect(onPromptsRequestHandled).toHaveBeenCalledOnce();
  });

  it('lists every section and offers Reset only on a customised one', async () => {
    await localStorage.set({ aiPrompts: { steps: { instructions: 'Be brief.' } } });
    render(<AiPromptsRow {...props} />);
    await waitFor(() => expect(screen.getByText('settings.aiCustomised')).toBeInTheDocument());
    expect(screen.getByText('settings.aiPromptDefault')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'settings.aiReset: settings.aiForSteps' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'settings.aiReset: settings.aiForGuide' })).not.toBeInTheDocument();
  });

  it('shows a customised section and resets it', async () => {
    await localStorage.set({ aiPrompts: { steps: { instructions: 'Be brief.' } } });
    const onChange = vi.fn();
    render(<AiPromptsRow {...props} onChange={onChange} />);
    await waitFor(() => expect(screen.getByText('settings.aiCustomised')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /settings.aiReset/ }));
    fireEvent.click(screen.getByRole('button', { name: 'settings.aiReset' }));
    await waitFor(() => expect(screen.queryByText('settings.aiCustomised')).not.toBeInTheDocument());
    expect(onChange).toHaveBeenCalledWith({ aiPrompts: {} });
  });

  it('asks before resetting and keeps everything on cancel', async () => {
    const stored = { steps: { instructions: 'Be brief.' } };
    await localStorage.set({ aiPrompts: stored });
    const onChange = vi.fn();
    render(<AiPromptsRow {...props} onChange={onChange} />);
    await waitFor(() => expect(screen.getByText('settings.aiCustomised')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /settings.aiReset/ }));
    expect(screen.getByText('settings.aiResetConfirmMessage')).toBeInTheDocument();
    expect((await localStorage.get(['aiPrompts'])).aiPrompts).toEqual(stored);
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
    await waitFor(() => expect(screen.queryByText('settings.aiResetConfirmMessage')).not.toBeInTheDocument());
    expect((await localStorage.get(['aiPrompts'])).aiPrompts).toEqual(stored);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('names each reset after its section', async () => {
    await localStorage.set({
      aiPrompts: { steps: { instructions: 'Be brief.' }, guide: { instructions: 'Be kind.' } },
    });
    render(<AiPromptsRow {...props} />);
    await waitFor(() => expect(screen.getAllByRole('button', { name: /settings.aiReset/ })).toHaveLength(2));
    expect(screen.getByRole('button', { name: 'settings.aiReset: settings.aiForSteps' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'settings.aiReset: settings.aiForGuide' })).toBeInTheDocument();
  });

  it('resets against what is in storage now, not what it loaded', async () => {
    await localStorage.set({ aiPrompts: { steps: { instructions: 'A' } } });
    render(<AiPromptsRow {...props} />);
    await waitFor(() => expect(screen.getByText('settings.aiCustomised')).toBeInTheDocument());
    await localStorage.set({ aiPrompts: { steps: { instructions: 'B' }, guide: { instructions: 'C' } } });
    fireEvent.click(screen.getByRole('button', { name: 'settings.aiReset: settings.aiForSteps' }));
    fireEvent.click(screen.getByRole('button', { name: 'settings.aiReset' }));
    await waitFor(async () => {
      expect((await localStorage.get(['aiPrompts'])).aiPrompts).toEqual({ guide: { instructions: 'C' } });
    });
  });

  it('reloads when the page becomes visible', async () => {
    render(<AiPromptsRow {...props} />);
    expect(screen.queryByText('settings.aiCustomised')).not.toBeInTheDocument();
    await localStorage.set({ aiPrompts: { guide: { instructions: 'C' } } });
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(screen.getByText('settings.aiCustomised')).toBeInTheDocument());
  });

  it('reloads when the window gains focus', async () => {
    render(<AiPromptsRow {...props} />);
    await localStorage.set({ aiPrompts: { guide: { instructions: 'C' } } });
    window.dispatchEvent(new Event('focus'));
    await waitFor(() => expect(screen.getByText('settings.aiCustomised')).toBeInTheDocument());
  });

  it('leaves the language alone when the dialog did not change it', async () => {
    await localStorage.set({ aiLanguage: 'es' });
    const onLanguageChange = vi.fn();
    render(<AiPromptsRow onLanguageChange={onLanguageChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'editor.edit: settings.aiForSteps' }));
    const save = screen.getByRole('button', { name: 'common.save' });
    await waitFor(() => expect(save).toBeEnabled());
    await localStorage.set({ aiLanguage: 'ja' });
    fireEvent.click(save);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onLanguageChange).not.toHaveBeenCalled();
    expect((await localStorage.get(['aiLanguage'])).aiLanguage).toBe('ja');
  });

  it('shows both sections as default when nothing is customised', async () => {
    render(<AiPromptsRow {...props} />);
    await waitFor(() => expect(screen.getAllByText('settings.aiPromptDefault')).toHaveLength(2));
    expect(screen.queryByText('settings.aiCustomised')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /settings.aiReset/ })).not.toBeInTheDocument();
  });
});
