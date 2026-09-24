export function unwrapQuotes(text: string): string {
  const trimmed = text.trim();
  const wrapped =
    trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"') && !trimmed.slice(1, -1).includes('"');
  return wrapped ? trimmed.slice(1, -1).trim() : trimmed;
}
