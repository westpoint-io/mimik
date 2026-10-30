export function moveSteps<T extends { id: string }>(items: T[], ids: string[], overId: string, after: boolean): T[] {
  const moving = new Set(ids);
  if (moving.has(overId)) return items;
  const picked = items.filter((item) => moving.has(item.id));
  const rest = items.filter((item) => !moving.has(item.id));
  const at = rest.findIndex((item) => item.id === overId);
  if (at === -1 || picked.length === 0) return items;
  const insertAt = after ? at + 1 : at;
  return [...rest.slice(0, insertAt), ...picked, ...rest.slice(insertAt)];
}
