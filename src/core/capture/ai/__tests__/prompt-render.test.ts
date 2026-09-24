import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateTextMock, generateObjectMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
  generateObjectMock: vi.fn(),
}));

vi.mock('ai', () => ({
  generateText: generateTextMock,
  generateObject: generateObjectMock,
  jsonSchema: (schema: unknown) => schema,
}));

vi.mock('../provider', () => ({ createModel: () => ({ id: 'test-model' }) }));

vi.mock('@/lib/browser-api', () => ({
  localStorage: { get: vi.fn().mockResolvedValue({ aiLanguage: 'en' }) },
}));

import { localStorage } from '@/lib/browser-api';
import type { DOMContext } from '../../dom/context';
import { getAIDescription } from '../description';
import { resolveExamples } from '../examples';
import { generateGuideMeta } from '../meta';
import { AI_LANGUAGES, type AILanguageCode } from '../prompts';

const CONTEXT: DOMContext = {
  page: { title: 'Settings', path: '/settings' },
  container: null,
  heading: null,
  siblings: [],
  target: { tag: 'button', role: null, name: 'Update profile', value: null, action: 'click' },
};

const STEPS = [{ description: 'Click Directory', url: 'https://admin.okta.com/users' }];

async function stepPrompt(aiLanguage: string): Promise<string> {
  vi.mocked(localStorage.get).mockResolvedValue({ aiLanguage });
  generateTextMock.mockReset();
  generateTextMock.mockResolvedValue({ text: 'ok' });
  await getAIDescription(CONTEXT, 'openai', 'gpt-4o-mini', 'key');
  return generateTextMock.mock.calls[0][0].prompt as string;
}

async function metaPrompt(aiLanguage: string): Promise<string> {
  vi.mocked(localStorage.get).mockResolvedValue({ aiLanguage });
  generateObjectMock.mockReset();
  generateObjectMock.mockResolvedValue({ object: { title: 'T', description: 'D' } });
  await generateGuideMeta(STEPS, 'openai', 'gpt-4o-mini', 'key');
  return generateObjectMock.mock.calls[0][0].prompt as string;
}

const CODES = AI_LANGUAGES.map((l) => l.code) as readonly AILanguageCode[];

const EXPECTED: Record<AILanguageCode, { step: string; title: string }> = {
  en: { step: 'Click the Submit button', title: 'Configure Slack Notification Preferences' },
  es: { step: 'Hacer clic en el botón Submit', title: 'Configurar las notificaciones de Slack' },
  fr: { step: 'Cliquer sur le bouton Submit', title: 'Configurer les notifications Slack' },
  de: { step: 'Auf die Schaltfläche Submit klicken', title: 'Slack-Benachrichtigungen konfigurieren' },
  'pt-BR': { step: 'Clicar no botão Submit', title: 'Configurar as notificações do Slack' },
  'zh-CN': { step: '点击 Submit 按钮', title: '配置 Slack 通知偏好' },
};

describe.each(CODES)('rendered prompts for %s', (code) => {
  beforeEach(() => {
    vi.mocked(localStorage.get).mockResolvedValue({ aiLanguage: code });
  });

  it('fills every placeholder in both prompts', async () => {
    expect(await stepPrompt(code)).not.toMatch(/\{\{\w+\}\}/);
    expect(await metaPrompt(code)).not.toMatch(/\{\{\w+\}\}/);
  });

  it('carries this language own examples', async () => {
    expect(await stepPrompt(code)).toContain(EXPECTED[code].step);
    expect(await metaPrompt(code)).toContain(EXPECTED[code].title);
  });

  it('renders every example bullet without a nested quote collision', async () => {
    for (const prompt of [await stepPrompt(code), await metaPrompt(code)]) {
      for (const line of prompt.split('\n')) {
        if (line.startsWith('- ')) expect(line).not.toMatch(/^- ".*".*"/);
      }
    }
  });

  it('keeps UI labels and product names untranslated in the examples', async () => {
    const step = await stepPrompt(code);
    expect(step).toContain('Submit');
    expect(step).toContain('Settings');
    const meta = await metaPrompt(code);
    expect(meta).toContain('claude-code');
    expect(meta).toContain('Workday');
  });

  it('states the never-translate rule in both prompts', async () => {
    expect(await stepPrompt(code)).toContain('Never translate');
    expect(await metaPrompt(code)).toContain('Never translate');
  });

  it('appends a native-language instruction, or none at all for English', async () => {
    const step = await stepPrompt(code);
    if (code === 'en') {
      expect(step).not.toContain('IMPORTANT: Write the output in');
      expect(step).not.toContain('IMPORTANTE');
    } else {
      expect(step).not.toContain('Write the output in');
      expect(await metaPrompt(code)).not.toContain('Write the output in');
    }
  });

  it('never leaks another language examples', async () => {
    const step = await stepPrompt(code);
    for (const other of CODES) {
      if (other === code) continue;
      expect(step).not.toContain(resolveExamples(other).steps[0]);
    }
  });
});
