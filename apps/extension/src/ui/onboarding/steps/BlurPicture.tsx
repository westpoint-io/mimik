import { PRESET_LABELS, type PresetKey } from '@/core/blur/patterns';

const SAMPLES: Record<PresetKey, { label: string; value: string }> = {
  email: { label: '@', value: 'ana@acme.com' },
  phone: { label: '#', value: '+1 415 555 0182' },
  ssn: { label: '§', value: '123-45-6789' },
  creditCard: { label: '$', value: '4242 4242 4242' },
  ipAddress: { label: '◎', value: '192.168.1.24' },
  macAddress: { label: '⇌', value: '3C:22:FB:9A:41:07' },
};

export function BlurPicture({ presets }: { presets: Record<PresetKey, boolean> }) {
  return (
    <div className="light absolute inset-x-[9%] top-[12%] bottom-0 flex flex-col justify-evenly overflow-hidden rounded-t-[7px] bg-white px-[9%] py-1 text-[7.5px] leading-none shadow-[0_4px_14px_rgba(30,27,75,0.12)]">
      <span className="absolute inset-x-0 top-0 h-0.5 animate-[ob-scan_4s_ease-in-out_infinite] bg-primary opacity-0 motion-reduce:hidden" />
      {(Object.keys(PRESET_LABELS) as PresetKey[]).map((key) => (
        <div key={key} className="flex items-center justify-between gap-1.5">
          <span className="text-muted-foreground">{SAMPLES[key].label}</span>
          <span
            className={`font-semibold text-foreground transition-[filter] duration-300 motion-reduce:transition-none ${presets[key] ? 'blur-[2.5px]' : ''}`}
          >
            {SAMPLES[key].value}
          </span>
        </div>
      ))}
    </div>
  );
}
