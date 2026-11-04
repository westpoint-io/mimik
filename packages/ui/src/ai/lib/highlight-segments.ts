interface Segment {
  key: string;
  text: string;
  marked: boolean;
}

export function highlightSegments(text: string, blocks: readonly string[]): Segment[] {
  const segments: Segment[] = [];
  let rest = text;
  for (const [index, block] of blocks.entries()) {
    const at = rest.indexOf(block);
    if (at < 0) continue;
    if (at > 0) segments.push({ key: `before-${index}`, text: rest.slice(0, at), marked: false });
    segments.push({ key: `block-${index}`, text: block, marked: true });
    rest = rest.slice(at + block.length);
  }
  if (rest) segments.push({ key: 'tail', text: rest, marked: false });
  return segments;
}
