import { Button, Switch } from '@mimik/ui';
import { EyeOff, MousePointer2, X } from 'lucide-react';
import { type PointerEvent, useRef, useState } from 'react';
import { i18n } from '#imports';
import { PRESET_LABELS, type PresetKey } from '@/core/blur/patterns';

const PRESET_KEYS: PresetKey[] = ['email', 'phone', 'ssn', 'creditCard', 'ipAddress', 'macAddress'];

export function BlurPanel({ initial }: { initial: Record<PresetKey, boolean> }) {
  const [presets, setPresets] = useState(initial);
  const [manual, setManual] = useState(PRESET_KEYS.some((key) => initial[key]));
  const [place, setPlace] = useState({ left: 20, top: 20 });
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  const emit = (name: string, detail?: unknown) => document.dispatchEvent(new CustomEvent(name, { detail }));
  const apply = (next: Record<PresetKey, boolean>) => {
    setPresets(next);
    emit('mimik-blur:update-presets', { presets: PRESET_KEYS.filter((key) => next[key]) });
  };
  const toggleManual = (on: boolean) => {
    setManual(on);
    if (!on) apply(Object.fromEntries(PRESET_KEYS.map((key) => [key, false])) as Record<PresetKey, boolean>);
  };
  const grab = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    drag.current = { x: event.clientX, y: event.clientY, ...place };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const from = drag.current;
    if (from) setPlace({ left: from.left + event.clientX - from.x, top: from.top + event.clientY - from.y });
  };

  return (
    <div
      style={place}
      className="pointer-events-auto fixed flex w-[280px] flex-col overflow-hidden rounded-xl border border-lavender bg-white text-foreground shadow-[0_8px_32px_rgba(0,0,0,0.12)] select-none"
    >
      <div
        onPointerDown={grab}
        onPointerMove={move}
        onPointerUp={() => {
          drag.current = null;
        }}
        className="flex cursor-grab items-center justify-between px-4 pt-3.5 pb-2.5 active:cursor-grabbing"
      >
        <span className="flex items-center gap-1.5 text-[14px] font-bold">
          <EyeOff size={16} />
          {i18n.t('blurPanel.title')}
        </span>
        <button
          type="button"
          aria-label={i18n.t('common.close')}
          onClick={() => emit('mimik-blur:done')}
          className="flex size-7 items-center justify-center rounded-lg transition-colors hover:bg-secondary"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-col gap-3.5 px-4 pb-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold">{i18n.t('blurPanel.manualMode')}</span>
            <Switch checked={manual} label={i18n.t('blurPanel.manualMode')} onChange={toggleManual} />
          </div>
          {manual && (
            <div className="flex flex-wrap gap-1.5">
              {PRESET_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={presets[key]}
                  onClick={() => apply({ ...presets, [key]: !presets[key] })}
                  className={`rounded-full px-2.5 py-1 text-[11px] leading-[1.4] font-semibold transition-colors ${
                    presets[key]
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-foreground hover:bg-lavender'
                  }`}
                >
                  {PRESET_LABELS[key]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="-mx-4 h-px bg-lavender" />

        <Button
          variant="outline"
          onClick={() => emit('mimik-blur:start-picker')}
          className="h-9 w-full rounded-lg text-[12px] font-semibold"
        >
          <MousePointer2 size={13} />
          {i18n.t('blurPanel.clickToBlur')}
        </Button>
        <button
          type="button"
          onClick={() => emit('mimik-blur:reset')}
          className="self-center py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          {i18n.t('blurPanel.resetAll')}
        </button>
      </div>

      <div className="border-t border-lavender px-4 py-3">
        <Button onClick={() => emit('mimik-blur:done')} className="h-9 w-full rounded-lg text-[12px] font-bold">
          {i18n.t('blurPanel.doneResume')}
        </Button>
      </div>
    </div>
  );
}
