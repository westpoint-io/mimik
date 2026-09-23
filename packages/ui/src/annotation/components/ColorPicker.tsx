import { hexToHsv, hsvToHex, normalizeHex } from '@mimik/core/screenshot/color';
import { SHAPE_COLORS } from '@mimik/core/screenshot/types';
import { Input } from '@mimik/ui/components/ui/input';
import { useRef, useState } from 'react';
import { swatchStyle } from '../lib/swatch-style';

interface ColorPickerProps {
  value: string;
  allowNone?: boolean;
  presets?: readonly string[];
  onChange: (color: string) => void;
}

export default function ColorPicker({ value, allowNone, presets = SHAPE_COLORS, onChange }: ColorPickerProps) {
  const [draft, setDraft] = useState(value);
  const areaRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  const hsv = hexToHsv(normalizeHex(value) ?? '#000000');
  const hueHex = hsvToHex({ h: hsv.h, s: 1, v: 1 });

  const track = (
    ref: React.RefObject<HTMLDivElement | null>,
    e: React.PointerEvent,
    read: (fx: number, fy: number) => void,
  ) => {
    const el = ref.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    const apply = (clientX: number, clientY: number) => {
      const r = el.getBoundingClientRect();
      read(
        Math.max(0, Math.min(1, (clientX - r.left) / r.width)),
        Math.max(0, Math.min(1, (clientY - r.top) / r.height)),
      );
    };
    apply(e.clientX, e.clientY);
    const move = (ev: PointerEvent) => apply(ev.clientX, ev.clientY);
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  const commit = (next: string) => {
    setDraft(next);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div
        ref={areaRef}
        onPointerDown={(e) => track(areaRef, e, (fx, fy) => commit(hsvToHex({ h: hsv.h, s: fx, v: 1 - fy })))}
        className="relative h-32 w-full rounded-lg cursor-crosshair touch-none"
        style={{
          backgroundImage: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #FFF, ${hueHex})`,
        }}
      >
        <span
          className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: value }}
        />
      </div>

      <div
        ref={hueRef}
        onPointerDown={(e) => track(hueRef, e, (fx) => commit(hsvToHex({ h: fx * 360, s: hsv.s || 1, v: hsv.v || 1 })))}
        className="relative h-3.5 w-full rounded-full cursor-ew-resize touch-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, #F00 0%, #FF0 17%, #0F0 33%, #0FF 50%, #00F 67%, #F0F 83%, #F00 100%)',
        }}
      >
        <span
          className="absolute top-1/2 w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: hueHex }}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(allowNone ? presets : presets.filter((c) => c !== 'transparent')).map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            onClick={() => commit(c)}
            className={`w-[18px] h-[18px] rounded-full border border-border transition-transform ${
              value === c ? 'ring-2 ring-accent ring-offset-1' : 'hover:scale-110'
            }`}
            style={swatchStyle(c)}
          />
        ))}
      </div>

      <Input
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          const norm = normalizeHex(e.target.value);
          if (norm) onChange(norm);
        }}
        onBlur={() => setDraft(value)}
        spellCheck={false}
        className="h-7 w-full text-[11px] uppercase"
      />
    </div>
  );
}
