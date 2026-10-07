const INITIAL_GRADIENTS = [
  ['#6366F1', '#818CF8'],
  ['#8B5CF6', '#A78BFA'],
  ['#EC4899', '#F472B6'],
  ['#14B8A6', '#2DD4BF'],
  ['#F59E0B', '#FBBF24'],
  ['#3B82F6', '#60A5FA'],
] as const;

export function getDomainInitial(domain: string): { letter: string; gradient: readonly [string, string] } {
  const letter = domain.charAt(0).toUpperCase();
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = (hash * 31 + domain.charCodeAt(i)) | 0;
  }
  const gradient = INITIAL_GRADIENTS[Math.abs(hash) % INITIAL_GRADIENTS.length]!;
  return { letter, gradient };
}
