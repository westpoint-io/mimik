const WORD = /[\p{L}\p{N}]/u;

function quotesPairUp(inner: string): boolean {
  let open = 0;
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] !== '"') continue;
    const wordLeft = i > 0 && WORD.test(inner[i - 1]);
    const wordRight = i < inner.length - 1 && WORD.test(inner[i + 1]);
    if (wordLeft === wordRight) return false;
    if (wordRight) open++;
    else if (open-- === 0) return false;
  }
  return open === 0;
}

export function unwrapQuotes(text: string): string {
  const trimmed = text.trim();
  const wrapped =
    trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"') && quotesPairUp(trimmed.slice(1, -1));
  return wrapped ? trimmed.slice(1, -1).trim() : trimmed;
}
