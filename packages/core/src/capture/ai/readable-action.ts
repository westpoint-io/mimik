export function readableAction(action: string): string {
  return action === 'auxclick' ? 'right-click' : action;
}
