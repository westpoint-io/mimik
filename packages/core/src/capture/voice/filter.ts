import type { ScoredTranscriptSegment, TranscriptSegment } from './types';

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.+$/, '');
}

const BLOCKLIST = new Set(
  [
    'thank you',
    'thanks for watching',
    'thank you for watching',
    'thanks for listening',
    'please subscribe',
    "don't forget to subscribe",
    'like and subscribe',
    'subtitles by the amara.org community',
    'transcription by castingwords',
    'amara.org',
    '[music]',
    '[applause]',
    'music',
    'applause',
    'продолжение следует',
    'субтитры сделал dimatorzok',
    "sous-titres réalisés par la communauté d'amara.org",
    '由 amara.org 社群提供的字幕',
  ].map(normalise),
);

const SOLO_ONLY = new Set(['you', 'so', 'the', 'oh', 'okay', 'ok', 'yeah', 'hmm']);

function isScored(segment: TranscriptSegment): segment is ScoredTranscriptSegment {
  return (
    typeof segment.no_speech_prob === 'number' &&
    typeof segment.avg_logprob === 'number' &&
    typeof segment.compression_ratio === 'number'
  );
}

export function rejectReason(segment: TranscriptSegment): string | null {
  const text = normalise(segment.text ?? '');
  if (!text) return 'empty';
  if (!isScored(segment)) return 'unscored';
  if (segment.no_speech_prob > 0.6) return `no_speech_prob=${segment.no_speech_prob}`;
  if (segment.avg_logprob < -1) return `avg_logprob=${segment.avg_logprob}`;
  if (segment.compression_ratio > 2.4) return `compression_ratio=${segment.compression_ratio}`;
  if (BLOCKLIST.has(text)) return `blocklist:${text}`;
  if (SOLO_ONLY.has(text)) return `solo-filler:${text}`;
  return null;
}
