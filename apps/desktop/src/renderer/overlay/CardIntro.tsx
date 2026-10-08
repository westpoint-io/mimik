import { CameraMascot } from '@mimik/ui';

interface CardIntroProps {
  hidden: boolean;
  waiting: boolean;
  resting: boolean;
  tip: string;
}

export function CardIntro({ hidden, waiting, resting, tip }: CardIntroProps) {
  return (
    <div
      id="intro"
      hidden={hidden}
      className={waiting ? 'flex flex-col items-center gap-2 pt-3 pb-1 text-center' : 'flex items-center gap-3 pb-0.5'}
    >
      <div id="mascot" className={`flex shrink-0 ${resting ? 'animate-[rest_3.2s_ease-in-out_infinite]' : ''}`}>
        <CameraMascot size={waiting ? 76 : 56} flash={resting ? 'off' : 'loop'} />
      </div>
      <p
        id="tip"
        className={`leading-normal text-foreground ${waiting ? 'text-[13px] font-semibold' : 'text-[12.5px]'}`}
      >
        {tip}
      </p>
    </div>
  );
}
