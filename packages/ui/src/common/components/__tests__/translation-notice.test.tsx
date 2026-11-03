// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { i18n } from '@mimik/core/env';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tabs } from '../../../env';
import { TranslationNotice } from '../TranslationNotice';

function inLocale(locale: string) {
  vi.spyOn(i18n, 't').mockImplementation((key: string) => (key === 'meta.locale' ? locale : key));
}

describe('TranslationNotice', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(['de', 'fr', 'ru', 'zh-CN', 'ja', 'ko', 'zh-TW'])('says %s was translated with AI', (locale) => {
    inLocale(locale);
    render(<TranslationNotice />);
    expect(screen.getByText('settings.machineTranslated')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'settings.fixTranslation' })).toBeInTheDocument();
  });

  it("opens the language's own file in the GitHub editor, which leads to a pull request", () => {
    inLocale('ja');
    const create = vi.spyOn(tabs, 'create').mockResolvedValue(undefined as never);
    render(<TranslationNotice />);
    fireEvent.click(screen.getByRole('button', { name: 'settings.fixTranslation' }));
    expect(create).toHaveBeenCalledWith('https://github.com/westpoint-io/mimik/edit/dev/packages/locales/ja.yml');
  });

  it.each(['en', 'es', 'pt-BR'])('stays out of the way in %s, which a native speaker reviewed', (locale) => {
    inLocale(locale);
    const { container } = render(<TranslationNotice />);
    expect(container).toBeEmptyDOMElement();
  });
});
