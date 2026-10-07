import { describe, expect, it } from 'vitest';
import type { ElementMeta } from '@/core/guides/types';
import { serializeScreenContext } from '../screen-context';

const meta = (over: Partial<ElementMeta> = {}): ElementMeta => ({
  source: 'uia',
  textContent: null,
  ariaLabel: null,
  placeholder: null,
  altText: null,
  name: null,
  role: null,
  rect: { x: 0, y: 0, width: 1, height: 1 },
  devicePixelRatio: 1,
  ...over,
});

describe('serializeScreenContext', () => {
  it('names the application, window and control', () => {
    const text = serializeScreenContext(
      'click',
      meta({
        role: 'button',
        ariaLabel: 'Save',
        app: { name: 'Notepad' },
        window: { title: 'Untitled' },
      }),
    );
    expect(text).toContain('Application: Notepad');
    expect(text).toContain('Window: "Untitled"');
    expect(text).toContain('→ Target: button "Save" (click)');
  });

  it('carries the typed value and says a key press is one', () => {
    expect(serializeScreenContext('input', meta({ role: 'textbox', textContent: 'hello' }))).toContain(
      'Value: "hello"',
    );
    const key = serializeScreenContext('keydown:Ctrl+S', meta({ role: 'document' }));
    expect(key).toContain('(key press)');
    expect(key).toContain('Key: Ctrl+S');
  });

  it('reads the control type as words and carries the step before', () => {
    const text = serializeScreenContext('click', meta({ role: 'treeitem', ariaLabel: 'Downloads' }), 'Click "Home"');
    expect(text).toContain('→ Target: tree item "Downloads" (click)');
    expect(text).toContain('Previous step: "Click "Home""');
  });

  it('says what it does not know rather than inventing it', () => {
    const text = serializeScreenContext('click', meta());
    expect(text).toContain('Application: unknown');
    expect(text).toContain('→ Target: control (click)');
    expect(text).not.toContain('Value:');
  });
});
