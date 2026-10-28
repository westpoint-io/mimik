export function toggleSelection(
  steps: { id: string }[],
  selected: Set<string>,
  anchorId: string | null,
  stepId: string,
  extend: boolean,
): Set<string> {
  const index = steps.findIndex((step) => step.id === stepId);
  if (index === -1) return selected;
  const anchor = extend && anchorId ? steps.findIndex((step) => step.id === anchorId) : -1;
  const from = anchor === -1 ? index : anchor;
  const adding = !selected.has(stepId);
  const next = new Set(selected);
  for (let i = Math.min(from, index); i <= Math.max(from, index); i++) {
    const id = steps[i]!.id;
    if (adding) next.add(id);
    else next.delete(id);
  }
  return next;
}
