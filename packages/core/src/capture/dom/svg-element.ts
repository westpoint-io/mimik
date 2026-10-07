const SVG_NS = 'http://www.w3.org/2000/svg';

export function svgElement(markup: string): SVGElement {
  const source = markup.includes('xmlns=') ? markup : markup.replace('<svg', `<svg xmlns="${SVG_NS}"`);
  const parsed = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
  return document.importNode(parsed, true) as unknown as SVGElement;
}
