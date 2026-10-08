import type { BrandLogo } from '@mimik/core/export/branding';

export function BrandPicture({ color, logo }: { color: string; logo: BrandLogo | null }) {
  return (
    <div className="absolute inset-x-[16%] top-[10%] bottom-0 flex flex-col overflow-hidden rounded-t-md bg-white shadow-[0_4px_14px_rgba(30,27,75,0.12)]">
      <div
        className="flex h-[22%] origin-left animate-[ob-fill-x_4s_ease-in-out_infinite] items-center gap-1 px-[7%] motion-reduce:animate-none"
        style={{ background: color }}
      >
        {logo ? (
          <img
            src={logo.dataUrl}
            alt=""
            className="h-2.5 max-w-[60%] animate-[ob-pop_4s_ease_infinite] rounded-[2px] bg-white object-contain motion-reduce:animate-none"
          />
        ) : (
          <span className="size-2.5 animate-[ob-pop_4s_ease_infinite] rounded-[2px] bg-white motion-reduce:animate-none" />
        )}
      </div>
      <div className="flex flex-col gap-[8%] p-[9%]">
        {['60%', '45%'].map((width) => (
          <div key={width} className="flex items-center gap-1">
            <span
              className="size-2 animate-[ob-pop_4s_ease_infinite] rounded-full motion-reduce:animate-none"
              style={{ background: color }}
            />
            <i className="block h-1 rounded-full bg-lavender/60" style={{ width }} />
          </div>
        ))}
      </div>
    </div>
  );
}
