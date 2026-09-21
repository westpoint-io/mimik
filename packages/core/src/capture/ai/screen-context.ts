import type { ElementMeta } from '@/core/guides/types';

export function serializeScreenContext(action: string, meta: ElementMeta): string {
  const lines: string[] = [];

  lines.push(`Application: ${meta.app?.name ?? 'unknown'}`);
  if (meta.window?.title) lines.push(`Window: "${meta.window.title}"`);

  const name = meta.ariaLabel ?? meta.name;
  const control = [meta.role ?? 'control', name ? `"${name}"` : null].filter(Boolean).join(' ');
  lines.push(`→ Target: ${control} (${action.startsWith('keydown:') ? 'key press' : action})`);

  if (meta.textContent) lines.push(`Value: "${meta.textContent.slice(0, 120)}"`);
  if (meta.altText) lines.push(`Help: "${meta.altText}"`);
  if (action.startsWith('keydown:')) lines.push(`Key: ${action.slice(8)}`);

  return lines.join('\n');
}
