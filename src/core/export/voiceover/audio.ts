export const VOICE_SAMPLE_RATE = 44100;

export type VoiceCodec = 'aac' | 'opus';

let context: OfflineAudioContext | null = null;

export function audioContext(): OfflineAudioContext {
  if (!context) context = new OfflineAudioContext(1, 1, VOICE_SAMPLE_RATE);
  return context;
}

export async function decodeClip(bytes: ArrayBuffer): Promise<AudioBuffer> {
  return toMono(await audioContext().decodeAudioData(bytes.slice(0)));
}

export function toMono(buffer: AudioBuffer): AudioBuffer {
  if (buffer.numberOfChannels === 1) return buffer;
  const mono = audioContext().createBuffer(1, buffer.length, buffer.sampleRate);
  const mixed = mono.getChannelData(0);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let sample = 0; sample < data.length; sample++) mixed[sample] += data[sample] / buffer.numberOfChannels;
  }
  return mono;
}

export function silence(samples: number, sampleRate = VOICE_SAMPLE_RATE): AudioBuffer {
  return audioContext().createBuffer(1, Math.max(1, samples), sampleRate);
}

export interface PlacedClip {
  startSec: number;
  buffer: AudioBuffer;
}

const CHUNK_SAMPLES = VOICE_SAMPLE_RATE * 5;

export type TrackPiece = { kind: 'silence'; samples: number } | { kind: 'clip'; buffer: AudioBuffer };

export function voiceTrackPieces(clips: PlacedClip[], totalSec: number, sampleRate = VOICE_SAMPLE_RATE): TrackPiece[] {
  const pieces: TrackPiece[] = [];
  let cursor = 0;

  const pad = (until: number) => {
    let remaining = until - cursor;
    while (remaining > 0) {
      const span = Math.min(remaining, CHUNK_SAMPLES);
      pieces.push({ kind: 'silence', samples: span });
      remaining -= span;
    }
    cursor = Math.max(cursor, until);
  };

  for (const clip of [...clips].sort((a, b) => a.startSec - b.startSec)) {
    pad(Math.round(clip.startSec * sampleRate));
    pieces.push({ kind: 'clip', buffer: clip.buffer });
    cursor += clip.buffer.length;
  }

  pad(Math.round(totalSec * sampleRate));
  return pieces;
}

export async function writeVoiceTrack(
  clips: PlacedClip[],
  totalSec: number,
  add: (buffer: AudioBuffer) => Promise<void>,
  sampleRate = VOICE_SAMPLE_RATE,
): Promise<void> {
  for (const piece of voiceTrackPieces(clips, totalSec, sampleRate)) {
    await add(piece.kind === 'clip' ? piece.buffer : silence(piece.samples, sampleRate));
  }
}

export async function pickVoiceCodec(container: 'mp4' | 'webm'): Promise<VoiceCodec | null> {
  const { canEncodeAudio } = await import('mediabunny');
  const codec: VoiceCodec = container === 'mp4' ? 'aac' : 'opus';
  return (await canEncodeAudio(codec, { numberOfChannels: 1, sampleRate: VOICE_SAMPLE_RATE })) ? codec : null;
}
