const NAVY = '#1E1B4B';
const DOT =
  'h-[6px] w-[6px] rounded-full bg-red-500 animate-[breathe_1.6s_ease-in-out_infinite] motion-reduce:animate-none';

export function RecordingPicture({ card }: { card: boolean }) {
  return (
    <div className="light absolute inset-x-[9%] top-[12%] bottom-0 overflow-hidden rounded-t-[7px] bg-white shadow-[0_4px_14px_rgba(30,27,75,0.12)]">
      <div
        className={`absolute inset-y-0 left-0 flex flex-col gap-[7%] px-[7%] pt-[9%] transition-[right] duration-300 ${card ? 'right-0' : 'right-[40%]'}`}
      >
        <span className="h-[6%] w-[52%] rounded-sm bg-lavender" />
        <span className="h-[6%] w-[82%] rounded-sm bg-secondary" />
        <span className="h-[6%] w-[72%] rounded-sm bg-secondary" />
        <span className="h-[6%] w-[78%] rounded-sm bg-secondary" />
        <span className="h-[6%] w-[64%] rounded-sm bg-secondary" />
      </div>

      {!card && (
        <div
          className="absolute inset-y-0 right-0 flex w-[40%] flex-col gap-[9%] px-[7%] pt-[10%]"
          style={{ backgroundColor: NAVY }}
        >
          <div className="flex items-center gap-[7%] self-center rounded-full bg-white/10 px-[10%] py-[6%]">
            <span className={DOT} />
            <span className="h-[4px] w-[32px] rounded-full bg-white/60" />
          </div>
          <div className="flex items-center gap-[6%]">
            <span className="aspect-[4/3] w-[26%] shrink-0 rounded-[2px] bg-white/85" />
            <span className="flex flex-1 flex-col gap-[3px]">
              <span className="h-[4px] w-[85%] rounded-full bg-white/70" />
              <span className="h-[4px] w-[55%] rounded-full bg-white/35" />
            </span>
          </div>
          <div className="flex items-center gap-[6%] animate-[step-pop_3.4s_ease-in-out_infinite] motion-reduce:animate-none">
            <span className="aspect-[4/3] w-[26%] shrink-0 rounded-[2px] bg-white/85" />
            <span className="flex flex-1 flex-col gap-[3px]">
              <span className="h-[4px] w-[70%] rounded-full bg-white/70" />
              <span className="h-[4px] w-[48%] rounded-full bg-white/35" />
            </span>
          </div>
        </div>
      )}

      {card && (
        <div
          className="absolute right-[6%] bottom-[8%] flex w-[42%] flex-col gap-[7px] rounded-[6px] p-[6%] shadow-[0_6px_16px_rgba(30,27,75,0.3)] animate-[mimik-float_3.6s_ease-in-out_infinite] motion-reduce:animate-none"
          style={{ backgroundColor: NAVY }}
        >
          <div className="flex items-center gap-[5%]">
            <span className={DOT} />
            <span className="h-[4px] w-[42%] rounded-full bg-white/60" />
          </div>
          <span className="aspect-[16/10] w-full rounded-[3px] bg-white/85 animate-[shot-pop_3.4s_ease-in-out_infinite] motion-reduce:animate-none" />
          <div className="flex items-center gap-[5%]">
            <span className="h-[9px] flex-1 rounded-full bg-primary" />
            <span className="h-[9px] w-[9px] rounded-full bg-white/25" />
            <span className="h-[9px] w-[9px] rounded-full bg-white/25" />
          </div>
        </div>
      )}
    </div>
  );
}
