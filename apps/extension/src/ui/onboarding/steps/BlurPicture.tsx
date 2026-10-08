import type { PresetKey } from '@/core/blur/patterns';

const LINES: { key: PresetKey; label: string; value: string }[] = [
  { key: 'email', label: '@', value: 'ana@acme.com' },
  { key: 'phone', label: '#', value: '+1 415 555 0182' },
  { key: 'creditCard', label: '$', value: '4242 4242 4242' },
];

export function BlurPicture({ presets }: { presets: Record<PresetKey, boolean> }) {
  return (
    <div className="absolute inset-x-[9%] top-[12%] bottom-0 flex flex-col gap-[9%] overflow-hidden rounded-t-[7px] bg-white p-[9%] text-[7.5px] shadow-[0_4px_14px_rgba(30,27,75,0.12)]">
      <span className="absolute inset-x-0 top-0 h-0.5 animate-[ob-scan_4s_ease-in-out_infinite] bg-primary opacity-0 motion-reduce:hidden" />
      {LINES.map(({ key, label, value }) => (
        <div key={key} className="flex items-center justify-between gap-1.5">
          <span className="text-muted-foreground">{label}</span>
          <span
            className={`font-semibold text-foreground ${presets[key] ? 'blur-[2.5px] animate-[ob-blur_4s_ease-in-out_infinite] motion-reduce:animate-none' : ''}`}
          >
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}
