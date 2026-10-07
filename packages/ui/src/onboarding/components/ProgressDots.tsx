export function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, position) => position + 1).map((i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all duration-300 ${
            i === current ? 'w-8 bg-accent' : i < current ? 'w-2 bg-accent/40' : 'w-2 bg-border'
          }`}
        />
      ))}
    </div>
  );
}
