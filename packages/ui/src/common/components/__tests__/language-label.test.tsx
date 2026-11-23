// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { AI_LANGUAGES } from '@mimik/core/capture/ai/prompts';
import { i18n } from '@mimik/core/env';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageLabel } from '../LanguageLabel';

const language = (code: string) => AI_LANGUAGES.find((item) => item.code === code)!;

describe('LanguageLabel', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(['ja', 'ko', 'zh-TW'])('marks %s as beta', (code) => {
    vi.spyOn(i18n, 't').mockImplementation((key: string) => key);
    render(<LanguageLabel language={language(code)} />);
    expect(screen.getByText(language(code).label)).toBeInTheDocument();
    expect(screen.getByText('settings.languageBeta')).toBeInTheDocument();
  });

  it.each(['en', 'es', 'pt-BR', 'fr', 'de', 'ru', 'zh-CN'])('shows %s without a beta mark', (code) => {
    vi.spyOn(i18n, 't').mockImplementation((key: string) => key);
    render(<LanguageLabel language={language(code)} />);
    expect(screen.getByText(language(code).label)).toBeInTheDocument();
    expect(screen.queryByText('settings.languageBeta')).not.toBeInTheDocument();
  });
});
