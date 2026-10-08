const OFFSETS = { chrome: 119, edge: 174, brave: 226, opera: 40, firefox: 57 } as const;

interface UserAgentBrands {
  brands?: { brand: string }[];
}

export function puzzleIconOffset(): number {
  if (import.meta.env.BROWSER === 'firefox') return OFFSETS.firefox;
  const brands = ((navigator as Navigator & { userAgentData?: UserAgentBrands }).userAgentData?.brands ?? []).map(
    (entry) => entry.brand,
  );
  const agent = navigator.userAgent;
  if (brands.includes('Microsoft Edge') || agent.includes('Edg/')) return OFFSETS.edge;
  if (brands.includes('Opera') || agent.includes('OPR/')) return OFFSETS.opera;
  if (brands.includes('Brave')) return OFFSETS.brave;
  return OFFSETS.chrome;
}
