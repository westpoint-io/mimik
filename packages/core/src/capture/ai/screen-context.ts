import type { ElementMeta } from '@/core/guides/types';

const READABLE_ROLES: Record<string, string> = {
  banner: 'title bar',
  columnheader: 'column header',
  combobox: 'drop-down list',
  img: 'image',
  listitem: 'list item',
  menubar: 'menu bar',
  menuitem: 'menu item',
  progressbar: 'progress bar',
  radio: 'radio button',
  rowgroup: 'header',
  scrollbar: 'scroll bar',
  spinbutton: 'number box',
  status: 'status bar',
  tablist: 'tab bar',
  textbox: 'text field',
  thumb: 'slider handle',
  treeitem: 'tree item',
};

export function serializeScreenContext(action: string, meta: ElementMeta, previous?: string): string {
  const lines: string[] = [];

  lines.push(`Application: ${meta.app?.name ?? 'unknown'}`);
  if (meta.window?.title) lines.push(`Window: "${meta.window.title}"`);
  if (previous) lines.push(`Previous step: "${previous}"`);

  const name = meta.ariaLabel ?? meta.name;
  const role = meta.role ? (READABLE_ROLES[meta.role] ?? meta.role) : 'control';
  const control = [role, name ? `"${name}"` : null].filter(Boolean).join(' ');
  lines.push(`→ Target: ${control} (${action.startsWith('keydown:') ? 'key press' : action})`);

  if (meta.textContent) lines.push(`Value: "${meta.textContent.slice(0, 120)}"`);
  if (meta.altText) lines.push(`Help: "${meta.altText}"`);
  if (action.startsWith('keydown:')) lines.push(`Key: ${action.slice(8)}`);

  return lines.join('\n');
}
