// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { extractDOMContext, serializeDOMContext } from '../context';

function targetName(html: string): string | null {
  document.body.innerHTML = html;
  return extractDOMContext(document.getElementById('target')!, 'click').target.name;
}

describe('extractDOMContext target name', () => {
  it('drops a glyph glued to the label', () => {
    expect(targetName('<div id="target" tabindex="9"><span>✓</span><span>Save</span></div>')).toBe('Save');
  });

  it('falls back to the tooltip when the only text is an icon', () => {
    expect(targetName('<div id="target" tabindex="-1" title="Print list">▤</div>')).toBe('Print list');
  });

  it('falls back to the tooltip when the text carries no letters or digits', () => {
    expect(targetName('<div id="target" tabindex="-1" title="More actions">⋯</div>')).toBe('More actions');
  });

  it('keeps symbols that are part of the label', () => {
    expect(targetName('<button id="target">C++</button>')).toBe('C++');
  });

  it('leaves out text hidden from assistive technology', () => {
    expect(targetName('<button id="target"><span aria-hidden="true">save</span>Save draft</button>')).toBe(
      'Save draft',
    );
  });

  it('keeps punctuation that belongs to the label', () => {
    expect(targetName('<div id="target" role="menuitem">Open…</div>')).toBe('Open…');
  });
});

describe('serializeDOMContext', () => {
  it('calls a secondary-button click a right-click', () => {
    document.body.innerHTML = '<button id="target">Open</button>';
    const ctx = extractDOMContext(document.getElementById('target')!, 'auxclick');
    expect(serializeDOMContext(ctx)).toContain('→ Target: button "Open" (right-click)');
  });
});
