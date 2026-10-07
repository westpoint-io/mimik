class MicFrameCollector extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const frameMs = options?.processorOptions?.frameMs ?? 250;
    this.pending = new Float32Array(Math.max(1, Math.round((sampleRate * frameMs) / 1000)));
    this.filled = 0;
  }

  process(inputs) {
    const mono = inputs[0]?.[0];
    if (!mono) return true;
    let read = 0;
    while (read < mono.length) {
      const room = this.pending.length - this.filled;
      const take = Math.min(room, mono.length - read);
      this.pending.set(mono.subarray(read, read + take), this.filled);
      this.filled += take;
      read += take;
      if (this.filled === this.pending.length) this.flush();
    }
    return true;
  }

  flush() {
    const bytes = new ArrayBuffer(this.pending.length * 2);
    const view = new DataView(bytes);
    for (let i = 0; i < this.pending.length; i++) {
      const level = Math.max(-1, Math.min(1, this.pending[i]));
      view.setInt16(i * 2, Math.round(level * 0x7fff), true);
    }
    this.port.postMessage(bytes, [bytes]);
    this.filled = 0;
  }
}

registerProcessor('mic-frames', MicFrameCollector);
