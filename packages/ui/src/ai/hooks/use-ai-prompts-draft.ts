import {
  type CustomPrompts,
  defaultPrompt,
  type PromptOverride,
  type PromptSection,
  resolvePrompt,
  swapExamples,
} from '@mimik/core/capture/ai/custom-prompts';
import type { AILanguageCode } from '@mimik/core/capture/ai/prompts';
import { localStorage } from '@mimik/core/env';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Draft {
  prompt: string;
  instructions: string;
}

type Drafts = Record<PromptSection, Draft>;

const SECTIONS: readonly PromptSection[] = ['steps', 'guide'];
const FLASH_MS = 1800;
const EMPTY: Drafts = {
  steps: { prompt: '', instructions: '' },
  guide: { prompt: '', instructions: '' },
};

interface Options {
  open: boolean;
  onSaved: (prompts: CustomPrompts, changedLanguage: AILanguageCode | null) => void;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function useAiPromptsDraft({ open, onSaved }: Options) {
  const [drafts, setDrafts] = useState<Drafts>(EMPTY);
  const [draftLanguage, setDraftLanguage] = useState<AILanguageCode>('en');
  const [loaded, setLoaded] = useState(false);
  const [flash, setFlash] = useState(false);
  const [switched, setSwitched] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const openedLanguage = useRef<AILanguageCode>('en');

  useEffect(() => {
    if (!open) return;
    setLoaded(false);
    setDrafts(EMPTY);
    setSwitched(false);
    clearTimeout(timer.current);
    setFlash(false);
    let cancelled = false;
    void localStorage.get(['aiPrompts', 'aiLanguage']).then(({ aiPrompts, aiLanguage }) => {
      if (cancelled) return;
      const language = (typeof aiLanguage === 'string' ? aiLanguage : 'en') as AILanguageCode;
      openedLanguage.current = language;
      setDraftLanguage(language);
      setDrafts({
        steps: {
          prompt: resolvePrompt('steps', aiPrompts, language),
          instructions: text(aiPrompts?.steps?.instructions),
        },
        guide: {
          prompt: resolvePrompt('guide', aiPrompts, language),
          instructions: text(aiPrompts?.guide?.instructions),
        },
      });
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const editPrompt = useCallback((section: PromptSection, prompt: string) => {
    setFlash(false);
    setDrafts((current) => ({ ...current, [section]: { ...current[section], prompt } }));
  }, []);

  const editInstructions = useCallback((section: PromptSection, instructions: string) => {
    setDrafts((current) => ({ ...current, [section]: { ...current[section], instructions } }));
  }, []);

  const resetPrompt = (section: PromptSection) => editPrompt(section, defaultPrompt(section, draftLanguage));

  const changeLanguage = (next: AILanguageCode) => {
    const swapped: Drafts = {
      steps: { ...drafts.steps, prompt: swapExamples('steps', drafts.steps.prompt, next) },
      guide: { ...drafts.guide, prompt: swapExamples('guide', drafts.guide.prompt, next) },
    };
    const changed = SECTIONS.some((section) => swapped[section].prompt !== drafts[section].prompt);
    setDrafts(swapped);
    setDraftLanguage(next);
    setFlash(changed);
    setSwitched(changed);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlash(false), FLASH_MS);
  };

  const canSave = SECTIONS.every((section) => drafts[section].prompt.trim().length > 0);

  const save = async () => {
    if (!canSave) return;
    const next: CustomPrompts = {};
    for (const section of SECTIONS) {
      const entry: PromptOverride = {};
      const { prompt } = drafts[section];
      const instructions = drafts[section].instructions.trim();
      if (prompt !== defaultPrompt(section, draftLanguage)) entry.prompt = prompt;
      if (instructions) entry.instructions = instructions;
      if (entry.prompt !== undefined || entry.instructions !== undefined) next[section] = entry;
    }
    await localStorage.set({ aiPrompts: next });
    onSaved(next, draftLanguage === openedLanguage.current ? null : draftLanguage);
  };

  return {
    drafts,
    draftLanguage,
    loaded,
    flash,
    switched,
    canSave,
    editPrompt,
    editInstructions,
    resetPrompt,
    changeLanguage,
    save,
  };
}
