import { assetUrl, i18n } from '@mimik/core/env';
import { Volume2, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRecordShortcut } from '../hooks/use-record-shortcut';
import { TrayMenu } from './TrayMenu';

const MAC = navigator.userAgent.includes('Mac');

export function TrayCard() {
  const [version, setVersion] = useState('');
  const shortcut = useRecordShortcut(MAC);
  const [before, after] = i18n
    .t(MAC ? 'onboarding.menuBarMessage' : 'onboarding.trayMessage', ['[[slot]]'])
    .split('[[slot]]');

  useEffect(() => {
    void window.mimik.version().then(setVersion);
  }, []);

  return (
    <section className="flex flex-col items-center gap-3 rounded-[18px] border border-lavender/60 bg-card px-7 py-6 text-center lg:row-span-3 lg:grid lg:grid-rows-subgrid lg:items-stretch lg:justify-items-center">
      <h2 className="text-[20px] font-bold text-foreground">
        {i18n.t(MAC ? 'onboarding.menuBarTitle' : 'onboarding.trayTitle')}
      </h2>
      <p className="-mt-1 max-w-[52ch] text-[13.5px] text-muted-foreground lg:mt-0 lg:self-center">
        {before}
        <kbd className="rounded-[5px] border border-lavender bg-card px-1.5 py-px text-[11px] font-semibold">
          {shortcut}
        </kbd>
        {after}
      </p>
      {MAC ? (
        <div
          aria-hidden="true"
          className="relative h-[230px] w-full lg:h-auto lg:min-h-[230px] max-w-[440px] overflow-hidden rounded-xl border border-lavender/60 bg-[radial-gradient(60%_70%_at_15%_100%,#F59E0B_0%,rgba(245,158,11,0)_60%),radial-gradient(55%_75%_at_85%_100%,#DB2777_0%,rgba(219,39,119,0)_62%),radial-gradient(70%_80%_at_50%_110%,#7C3AED_0%,rgba(124,58,237,0)_70%),linear-gradient(180deg,#1E3A8A_0%,#3B5BDB_45%,#A78BFA_100%)]"
        >
          <div className="absolute inset-x-0 top-0 flex h-6 items-center gap-3 bg-white/55 px-2.5 text-[10px] text-gray-900 backdrop-blur-md">
            <span className="h-3 w-2.5 rounded-[5px_5px_6px_6px] bg-gray-900" />
            <b>Finder</b>
            <span className="ml-auto flex items-center gap-2.5">
              <span className="flex h-[18px] w-6 items-center justify-center rounded-[5px] bg-black/15">
                <img src={assetUrl('/icon128.png')} alt="" className="size-3.5 max-w-none rounded-[3px]" />
              </span>
              <Wifi size={12} />
              <span>10:42</span>
            </span>
          </div>
          <TrayMenu mac version={version} />
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-[14px] border border-white/40 bg-white/35 px-2 py-1.5 backdrop-blur-md">
            {['a', 'b', 'c', 'd'].map((id) => (
              <i key={id} className="size-6 rounded-[7px] bg-white/70" />
            ))}
            <i className="flex size-6 items-center justify-center rounded-[7px] bg-primary">
              <img src={assetUrl('/icon128.png')} alt="" className="size-5 max-w-none rounded-[4px]" />
            </i>
          </div>
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="relative h-[230px] w-full lg:h-auto lg:min-h-[230px] max-w-[440px] overflow-hidden rounded-xl border border-lavender/60 bg-[radial-gradient(38%_60%_at_30%_66%,#1E40AF_0%,rgba(30,64,175,0)_72%),radial-gradient(30%_48%_at_20%_54%,#2563EB_0%,rgba(37,99,235,0)_72%),radial-gradient(26%_40%_at_38%_40%,#60A5FA_0%,rgba(96,165,250,0)_72%),linear-gradient(160deg,#EAF2FD_0%,#CFE0F7_55%,#B9D1F2_100%)]"
        >
          <TrayMenu mac={false} version={version} />
          <div className="absolute inset-x-0 bottom-0 flex h-[42px] items-center border-t border-black/5 bg-[#EEF1F7]/85 px-2.5 backdrop-blur-md">
            <span className="ml-[30%] flex items-center gap-2">
              <span className="grid grid-cols-2 gap-[1.5px]">
                {['a', 'b', 'c', 'd'].map((id) => (
                  <i key={id} className="size-2 rounded-[1px] bg-blue-600" />
                ))}
              </span>
              {['a', 'b', 'c'].map((id) => (
                <i key={id} className="size-[22px] rounded-[5px] bg-primary/15" />
              ))}
            </span>
            <span className="absolute right-2 flex items-center gap-2 text-[10px] text-gray-800">
              <span className="flex size-[26px] items-center justify-center rounded-[5px] bg-black/10">
                <img src={assetUrl('/icon128.png')} alt="" className="size-4 max-w-none rounded-[3px]" />
              </span>
              <Wifi size={14} />
              <Volume2 size={14} />
              <span className="leading-tight">10:42</span>
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
