import { useLayoutEffect, useRef } from 'react';

const PAD = 6;
const GAP = 10;
const EDGE = 8;

interface GuideMeMarkerProps {
  target: HTMLElement;
  description: string;
  number: number;
}

export function GuideMeMarker({ target, description, number }: GuideMeMarkerProps) {
  const highlight = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const place = () => {
      const box = highlight.current;
      const tag = label.current;
      if (!box || !tag) return;
      const rect = target.getBoundingClientRect();
      Object.assign(box.style, {
        left: `${rect.left - PAD}px`,
        top: `${rect.top - PAD}px`,
        width: `${rect.width + PAD * 2}px`,
        height: `${rect.height + PAD * 2}px`,
      });
      const size = tag.getBoundingClientRect();
      const below = rect.bottom + PAD + GAP;
      const above = rect.top - PAD - GAP - size.height;
      const left = Math.max(EDGE, Math.min(rect.left, window.innerWidth - size.width - EDGE));
      const spot =
        below + size.height < window.innerHeight
          ? { top: below, left }
          : above > 0
            ? { top: above, left }
            : { top: rect.top, left: rect.right + PAD + GAP };
      tag.style.top = `${spot.top}px`;
      tag.style.left = `${spot.left}px`;
    };

    place();
    window.addEventListener('scroll', place, true);
    const resize = new ResizeObserver(place);
    resize.observe(document.documentElement);
    return () => {
      window.removeEventListener('scroll', place, true);
      resize.disconnect();
    };
  }, [target]);

  return (
    <>
      <div
        ref={highlight}
        className="pointer-events-none fixed rounded-sm border-2 border-mascot shadow-[0_0_0_3px_rgba(79,70,229,0.15),0_0_12px_rgba(79,70,229,0.2)] transition-all duration-300"
      />
      <div
        ref={label}
        className="pointer-events-none fixed flex max-w-[320px] items-center gap-2 rounded-[10px] border border-black/5 bg-white px-3.5 py-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
      >
        <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-extrabold text-primary-foreground">
          {number}
        </span>
        <span className="text-[12px] leading-[1.35] font-semibold text-foreground">{description}</span>
      </div>
    </>
  );
}
