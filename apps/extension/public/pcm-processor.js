const CHUNK = 4800;

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Int16Array(CHUNK);
    this.index = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    for (const sample of channel) {
      this.buffer[this.index++] = sample > 1 ? 32767 : sample < -1 ? -32767 : (sample * 32767) | 0;
      if (this.index >= CHUNK) {
        this.port.postMessage(this.buffer.buffer, [this.buffer.buffer]);
        this.buffer = new Int16Array(CHUNK);
        this.index = 0;
      }
    }
    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
