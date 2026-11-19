const IDENTIFIER = /^(?=.*(?:[\d_.:[\]-]|[a-z][A-Z]))\S+$/;

export function isIdentifier(text: string | null | undefined): boolean {
  return IDENTIFIER.test(text ?? '');
}
