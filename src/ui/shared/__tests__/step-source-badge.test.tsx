// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DescriptionSource } from '@/core/guides/types';
import StepSourceBadge from '@/ui/shared/StepSourceBadge';

const SOURCES: DescriptionSource[] = ['ai', 'narration', 'heuristic', 'manual'];
const LOCALES = ['en', 'de', 'es', 'fr', 'pt-BR', 'zh-CN'];

describe('StepSourceBadge', () => {
  it('says nothing for a step recorded before the field existed', () => {
    const { container } = render(<StepSourceBadge source={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each(SOURCES)('renders a label for %s', (source) => {
    render(<StepSourceBadge source={source} />);
    expect(screen.getByText(/.+/)).toBeInTheDocument();
  });

  it('distinguishes a rule-based description from an AI one', () => {
    const { container: ai } = render(<StepSourceBadge source="ai" />);
    const { container: basic } = render(<StepSourceBadge source="heuristic" />);
    expect(ai.textContent).not.toBe(basic.textContent);
    expect(ai.firstElementChild?.className).not.toBe(basic.firstElementChild?.className);
  });

  it('carries a label for every source, in every locale', () => {
    for (const locale of LOCALES) {
      const text = readFileSync(join(process.cwd(), 'src/locales', `${locale}.yml`), 'utf8');
      for (const key of ['ai', 'voice', 'basic', 'edited', 'hint']) {
        expect(text, `${locale} is missing stepSource.${key}`).toContain(`  ${key}:`);
      }
    }
  });
});
