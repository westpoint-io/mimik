export function handedOffPcm(value: unknown): Int16Array | null {
  if (value instanceof Int16Array) return value.length > 0 ? value : null;
  if (value instanceof ArrayBuffer) return value.byteLength > 0 ? new Int16Array(value) : null;
  if (ArrayBuffer.isView(value)) {
    return value.byteLength > 0 ? new Int16Array(value.buffer, value.byteOffset, value.byteLength / 2) : null;
  }
  return null;
}
