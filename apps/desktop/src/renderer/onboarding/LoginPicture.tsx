import { assetUrl, i18n } from '@mimik/core/env';

const DOTS = ['a', 'b', 'c', 'd'];

export function LoginPicture({ mac }: { mac: boolean }) {
  return (
    <>
      <div
        className={`absolute inset-x-[14%] flex animate-[ob-login-out_5s_ease-in-out_infinite] flex-col items-center justify-center gap-1 rounded-lg bg-white text-[8px] font-semibold text-foreground shadow-[0_4px_14px_rgba(30,27,75,0.12)] motion-reduce:hidden ${
          mac ? 'top-[24%] bottom-[8%]' : 'top-[12%] bottom-[30%]'
        }`}
      >
        <span className="size-4 rounded-full bg-lavender/60" />
        {i18n.t('onboarding.loginWelcome')}
        <span className="flex gap-[3px]">
          {DOTS.map((dot, i) => (
            <i
              key={dot}
              className="size-1 animate-[ob-dot_5s_steps(1)_infinite] rounded-full bg-primary opacity-0"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
      </div>
      <div
        className={`absolute right-1.5 flex animate-[ob-toast_5s_ease_infinite] items-center gap-1 rounded-md bg-white px-1.5 py-[3px] text-[7px] font-semibold text-foreground opacity-0 shadow-[0_4px_10px_rgba(30,27,75,0.18)] motion-reduce:animate-none motion-reduce:opacity-100 ${
          mac ? 'top-[24%]' : 'bottom-[26%]'
        }`}
      >
        <img src={assetUrl('/icon128.png')} alt="" className="size-2.5 max-w-none rounded-[2px]" />
        {i18n.t('onboarding.loginReady')}
      </div>
      <div
        className={`absolute inset-x-0 flex h-[20%] items-center justify-end gap-1.5 px-2 text-[7px] ${
          mac ? 'top-0 bg-white/70 text-gray-900' : 'bottom-0 bg-gray-800 text-gray-200'
        }`}
      >
        <span className="flex animate-[ob-tray-in_5s_ease_infinite] items-center rounded bg-white/15 px-1 py-0.5 motion-reduce:animate-none">
          <img src={assetUrl('/icon128.png')} alt="" className="size-3 max-w-none rounded-[2px]" />
        </span>
        9:00
      </div>
    </>
  );
}
