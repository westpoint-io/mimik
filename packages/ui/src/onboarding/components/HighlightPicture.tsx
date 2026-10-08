import { DemoCursor } from './DemoCursor';

export function HighlightPicture({ color }: { color: string }) {
  return (
    <div className="absolute inset-x-[9%] top-[12%] bottom-0 flex flex-col gap-[9%] rounded-t-[7px] bg-white p-[10%] shadow-[0_4px_14px_rgba(30,27,75,0.12)]">
      <i className="block h-[5px] w-[55%] rounded-full bg-lavender/60" />
      <i className="block h-[5px] w-[80%] rounded-full bg-lavender/60" />
      <span className="relative mt-[4%] h-3.5 w-[44%] rounded bg-gray-200">
        <span
          className="absolute -inset-1 animate-[ob-mark_4s_ease-in-out_infinite] rounded-md border-2 motion-reduce:animate-none"
          style={{ borderColor: color }}
        />
        <DemoCursor className="top-[55%] left-[60%] animate-[ob-cur-in_4s_ease-in-out_infinite] motion-reduce:hidden" />
      </span>
      <i className="block h-[5px] w-[40%] rounded-full bg-lavender/60" />
    </div>
  );
}
