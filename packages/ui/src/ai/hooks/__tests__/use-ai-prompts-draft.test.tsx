// @vitest-environment jsdom
import { defaultPrompt } from '@mimik/core/capture/ai/custom-prompts';
import { localStorage } from '@mimik/core/env';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAiPromptsDraft } from '../use-ai-prompts-draft';

function setup(onSaved = vi.fn()) {
  return { onSaved, ...renderHook(() => useAiPromptsDraft({ open: true, onSaved })) };
}

describe('useAiPromptsDraft', () => {
  beforeEach(async () => {
    await localStorage.set({ aiPrompts: {}, aiLanguage: 'en' });
  });

  it('opens in the stored language with its examples', async () => {
    await localStorage.set({ aiLanguage: 'es' });
    const { result } = setup();
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.draftLanguage).toBe('es');
    expect(result.current.drafts.steps.prompt).toBe(defaultPrompt('steps', 'es'));
  });

  it('leaves an open draft alone when the stored language changes', async () => {
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.editInstructions('steps', 'Mine'));
    await localStorage.set({ aiLanguage: 'fr' });
    rerender();
    expect(result.current.draftLanguage).toBe('en');
    expect(result.current.drafts.steps.instructions).toBe('Mine');
  });

  it('loads the default prompts', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.drafts.steps.prompt).toBe(defaultPrompt('steps', 'en')));
  });

  it('reports loaded only after the drafts arrive', async () => {
    const { result } = setup();
    expect(result.current.loaded).toBe(false);
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.drafts.steps.prompt).toBe(defaultPrompt('steps', 'en'));
  });

  it('swaps the examples in both sections and flashes on a language change', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.drafts.steps.prompt).not.toBe(''));
    act(() => result.current.changeLanguage('es'));
    expect(result.current.drafts.steps.prompt).toBe(defaultPrompt('steps', 'es'));
    expect(result.current.drafts.guide.prompt).toBe(defaultPrompt('guide', 'es'));
    expect(result.current.flash).toBe(true);
  });

  it('does not flash when the examples were rewritten', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.drafts.steps.prompt).not.toBe(''));
    act(() => {
      result.current.editPrompt('steps', 'Own prompt');
      result.current.editPrompt('guide', 'Own prompt');
    });
    act(() => result.current.changeLanguage('es'));
    expect(result.current.flash).toBe(false);
  });

  it('blocks saving an empty prompt', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.canSave).toBe(true));
    act(() => result.current.editPrompt('guide', '   '));
    expect(result.current.canSave).toBe(false);
  });

  it('resets only the prompt', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.drafts.steps.prompt).not.toBe(''));
    act(() => {
      result.current.editPrompt('steps', 'Own prompt');
      result.current.editInstructions('steps', 'Be brief.');
    });
    act(() => result.current.resetPrompt('steps'));
    expect(result.current.drafts.steps).toEqual({ prompt: defaultPrompt('steps', 'en'), instructions: 'Be brief.' });
  });

  it('stores only what differs from the default', async () => {
    const { result, onSaved } = setup();
    await waitFor(() => expect(result.current.drafts.steps.prompt).not.toBe(''));
    act(() => result.current.editInstructions('steps', '  Be brief.  '));
    await act(() => result.current.save());
    expect(onSaved).toHaveBeenCalledWith({ steps: { instructions: 'Be brief.' } }, null);
    expect(await localStorage.get(['aiPrompts'])).toEqual({ aiPrompts: { steps: { instructions: 'Be brief.' } } });
  });

  it('saves without crashing when stored instructions are malformed', async () => {
    await localStorage.set({ aiPrompts: { steps: { instructions: 5 } } as never });
    const { result, onSaved } = setup();
    await waitFor(() => expect(result.current.drafts.steps.prompt).not.toBe(''));
    await act(() => result.current.save());
    expect(onSaved).toHaveBeenCalledWith({}, null);
    expect(await localStorage.get(['aiPrompts'])).toEqual({ aiPrompts: {} });
  });

  it('drops cancelled edits when reopened', async () => {
    await localStorage.set({ aiPrompts: { steps: { instructions: 'Stored.' } } });
    const { result, rerender } = renderHook((props) => useAiPromptsDraft(props), {
      initialProps: { open: true, onSaved: vi.fn() },
    });
    await waitFor(() => expect(result.current.drafts.steps.instructions).toBe('Stored.'));
    act(() => result.current.editInstructions('steps', 'Edited'));
    rerender({ open: false, onSaved: vi.fn() });
    rerender({ open: true, onSaved: vi.fn() });
    expect(result.current.drafts.steps.instructions).toBe('');
    await waitFor(() => expect(result.current.drafts.steps.instructions).toBe('Stored.'));
  });

  it('does not save before the load finishes', async () => {
    await localStorage.set({ aiPrompts: { steps: { instructions: 'Stored.' } } });
    const { result, onSaved } = setup();
    await act(() => result.current.save());
    expect(onSaved).not.toHaveBeenCalled();
    expect(await localStorage.get(['aiPrompts'])).toEqual({ aiPrompts: { steps: { instructions: 'Stored.' } } });
  });

  it('reports the language when it was changed in the dialog', async () => {
    const { result, onSaved } = setup();
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.changeLanguage('es'));
    await act(() => result.current.save());
    expect(onSaved).toHaveBeenCalledWith({}, 'es');
  });

  it('does not report a language changed elsewhere while the dialog was open', async () => {
    await localStorage.set({ aiLanguage: 'es' });
    const { result, onSaved } = setup();
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await localStorage.set({ aiLanguage: 'ja' });
    await act(() => result.current.save());
    expect(onSaved).toHaveBeenCalledWith({}, null);
  });
});
