interface ColorSwatchesProps {
  colors: readonly string[];
  value: string;
  label: string;
  onChange: (color: string) => void;
}

export function ColorSwatches({ colors, value, label, onChange }: ColorSwatchesProps) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          aria-pressed={value.toUpperCase() === color.toUpperCase()}
          aria-label={`${label} ${color}`}
          onClick={() => onChange(color)}
          style={{ background: color }}
          className={`size-[22px] rounded-full border-2 border-white ${
            value.toUpperCase() === color.toUpperCase()
              ? 'shadow-[0_0_0_2px_var(--color-primary)]'
              : 'shadow-[0_0_0_1px_var(--color-lavender)]'
          }`}
        />
      ))}
    </div>
  );
}
