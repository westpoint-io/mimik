const SPACE = /\s/u;
const WORD = /[\p{L}\p{N}]/u;

function opensQuote(inner: string, i: number): boolean | null {
  const spaceLeft = i === 0 || SPACE.test(inner[i - 1]);
  const spaceRight = i === inner.length - 1 || SPACE.test(inner[i + 1]);
  if (spaceLeft !== spaceRight) return spaceLeft;
  if (spaceLeft) return null;
  const wordLeft = WORD.test(inner[i - 1]);
  const wordRight = WORD.test(inner[i + 1]);
  return wordLeft === wordRight ? null : wordRight;
}

function quotesPairUp(inner: string): boolean {
  let open = 0;
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] !== '"') continue;
    const opens = opensQuote(inner, i);
    if (opens === null) return false;
    if (opens) open++;
    else if (open-- === 0) return false;
  }
  return open === 0;
}

function withoutStrayQuote(trimmed: string): string {
  if (trimmed.length < 2 || trimmed.indexOf('"') !== trimmed.lastIndexOf('"')) return trimmed;
  if (trimmed.startsWith('"')) return trimmed.slice(1).trim();
  if (trimmed.endsWith('"')) return trimmed.slice(0, -1).trim();
  return trimmed;
}

export function unwrapQuotes(text: string): string {
  const trimmed = text.trim();
  const wrapped =
    trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"') && quotesPairUp(trimmed.slice(1, -1));
  return wrapped ? trimmed.slice(1, -1).trim() : withoutStrayQuote(trimmed);
}
