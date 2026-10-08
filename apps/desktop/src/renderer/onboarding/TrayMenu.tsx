import { i18n } from '@mimik/core/env';

export function TrayMenu({ mac, version }: { mac: boolean; version: string }) {
  const item = mac ? 'rounded-[5px] px-2.5 py-[3px]' : 'rounded-[5px] px-2.5 py-1.5';
  return (
    <div
      className={`absolute w-[190px] border p-[5px] text-left text-[11.5px] text-gray-900 ${
        mac
          ? 'top-[27px] right-24 rounded-[9px] border-black/10 bg-[#F6F6F8]/90 shadow-[0_14px_30px_rgba(0,0,0,0.28)] backdrop-blur-md'
          : 'top-[calc(50%-21px)] right-[70px] -translate-y-1/2 rounded-[9px] border-gray-200 bg-white/95 shadow-[0_12px_28px_rgba(15,12,45,0.25)]'
      }`}
    >
      <div className={item}>{i18n.t('library.allGuides')}</div>
      <div className={`${item} font-semibold ${mac ? 'bg-blue-600 text-white' : 'bg-secondary'}`}>
        {i18n.t('capture.startCapture')}
      </div>
      <div className={item}>{i18n.t('settings.title')}</div>
      <hr className="mx-1.5 my-1 border-black/10" />
      <div className={`${item} text-gray-400`}>{i18n.t('desktop.version', [version])}</div>
      <hr className="mx-1.5 my-1 border-black/10" />
      <div className={item}>{i18n.t('desktop.trayQuit')}</div>
    </div>
  );
}
