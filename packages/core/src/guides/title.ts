export const MAX_TITLE_LENGTH = 70;

const ASCII_WHITESPACE = /[\t\n\r\f\v ]+/g;
const LINE_BREAKS = /[\r\n]+/g;

export function sanitizeGuideTitle(title: string): string {
  return title.replace(ASCII_WHITESPACE, ' ').trim();
}

export function stripTitleLineBreaks(title: string): string {
  return title.replace(LINE_BREAKS, ' ');
}
