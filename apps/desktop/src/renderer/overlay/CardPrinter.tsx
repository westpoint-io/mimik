import { i18n } from '@mimik/core/env';
import { CameraMascot } from '@mimik/ui';
import { MousePointer2 } from 'lucide-react';
import type { Ref } from 'react';

interface CardPrinterProps {
  printerRef: Ref<HTMLDivElement>;
  photoRef: Ref<HTMLSpanElement>;
  filmRef: Ref<HTMLSpanElement>;
  aimRef: Ref<HTMLSpanElement>;
  hidden: boolean;
  number: number;
  filmSrc: string | null;
  developing: boolean;
  fired: boolean;
  aimed: boolean;
}

export function CardPrinter({
  printerRef,
  photoRef,
  filmRef,
  aimRef,
  hidden,
  number,
  filmSrc,
  developing,
  fired,
  aimed,
}: CardPrinterProps) {
  return (
    <div
      id="printer"
      ref={printerRef}
      hidden={hidden}
      className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-2 rounded-[10px] border border-lavender/50 bg-secondary"
    >
      <div className="relative mb-[50px] size-[84px]">
        <span
          id="photo"
          ref={photoRef}
          data-developing={developing || undefined}
          className="absolute top-[29px] left-1/2 -ml-[27px] h-11 w-[54px] rounded-[2px] bg-white px-[3px] pt-[3px] pb-2 shadow-[0_4px_10px_rgba(30,27,75,0.18)] [transform:translateY(calc(var(--p)*0.48px))]"
        >
          <span ref={filmRef} className="film relative block size-full overflow-hidden rounded-[1px] bg-white">
            <img
              src={filmSrc ?? undefined}
              alt=""
              className={`absolute inset-0 size-full object-cover ${
                developing ? 'opacity-100 transition-opacity duration-[350ms] ease-out' : 'opacity-0'
              }`}
            />
            <span
              id="aim"
              ref={aimRef}
              hidden={!aimed}
              className="absolute size-0 before:absolute before:-top-[5px] before:-left-[7px] before:h-2.5 before:w-3.5 before:rounded-[1px] before:border before:border-dashed before:border-mascot before:content-['']"
            >
              <MousePointer2
                size={10}
                className="absolute -top-0.5 -left-0.5 fill-primary stroke-white [stroke-width:2.5]"
              />
            </span>
          </span>
        </span>
        <span className="absolute inset-0 flex">
          <CameraMascot size={84} flash={fired ? 'shutter' : 'off'} />
        </span>
        <span className="absolute top-[70px] left-1/2 -ml-8 h-[5px] w-16 rounded-[3px] bg-[#0f0d2e]" />
      </div>
      <span className="text-[11.5px] font-semibold">
        <span id="printing">{i18n.t('desktop.capturingStep', [String(number)])}</span>
        {' · '}
        <span className="tabular-nums after:[counter-reset:p_var(--p)] after:content-[counter(p)_'%']" />
      </span>
    </div>
  );
}
