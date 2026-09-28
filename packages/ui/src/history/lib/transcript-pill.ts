export function transcriptPill(active: boolean): string {
  return `px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
    active
      ? 'bg-secondary border-border text-foreground'
      : 'border-transparent text-muted-foreground hover:text-foreground'
  }`;
}
