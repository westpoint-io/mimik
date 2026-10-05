const KEY_ACTION = 'keydown:';

export function splitAtShortcut(text: string, action: string | undefined): [string, string, string] | null {
  if (!action?.startsWith(KEY_ACTION)) return null;
  const key = action.slice(KEY_ACTION.length);
  const at = key ? text.indexOf(key) : -1;
  return at < 0 ? null : [text.slice(0, at), key, text.slice(at + key.length)];
}
