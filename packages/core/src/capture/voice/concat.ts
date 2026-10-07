export function concat(chunks: Int16Array[], samples: number): Int16Array {
  const pcm = new Int16Array(samples);
  let offset = 0;
  for (const chunk of chunks) {
    pcm.set(chunk, offset);
    offset += chunk.length;
  }
  return pcm;
}
