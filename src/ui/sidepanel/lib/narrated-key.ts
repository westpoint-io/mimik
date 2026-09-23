export function narratedKey(narrated: number): string {
  if (narrated <= 0) return 'voice.narratedNone';
  return narrated === 1 ? 'voice.narrated' : 'voice.narratedPlural';
}
