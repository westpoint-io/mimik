import { client, i18n } from '@mimik/core/env';
import { Check, Mic, Pause, Trash2, X } from 'lucide-react';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { MascotIcon } from '../../common/components/MascotIcon';

const LOOP_MS = 9600;
const TYPED = 'ana@acme.com';

interface Point {
  x: number;
  y: number;
}

interface DemoState {
  open: boolean;
  recording: boolean;
  steps: string[];
  typed: string;
  mark: 'field' | 'button' | null;
  guide: boolean;
  cursor: Point;
  ripple: (Point & { n: number }) | null;
  plus: Point | null;
}

const START: DemoState = {
  open: false,
  recording: false,
  steps: [],
  typed: '',
  mark: null,
  guide: false,
  cursor: { x: -1, y: -1 },
  ripple: null,
  plus: null,
};

export function CaptureDemo({ onPhase }: { onPhase: (phase: 1 | 2 | 3) => void }) {
  const desktop = client() === 'desktop';
  const box = useRef<HTMLDivElement>(null);
  const pin = useRef<HTMLSpanElement>(null);
  const field = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLSpanElement>(null);
  const finish = useRef<HTMLSpanElement>(null);
  const [demo, setDemo] = useState<DemoState>({ ...START, open: desktop });
  const stepType = i18n.t('onboarding.demoStepType');
  const stepClick = i18n.t('onboarding.demoStepClick');

  useEffect(() => {
    const timers: number[] = [];
    const at = (ms: number, run: () => void) => timers.push(window.setTimeout(run, ms));
    const point = (target: RefObject<HTMLElement | null>, dx = 0, dy = 0): Point => {
      const outer = box.current?.getBoundingClientRect();
      const inner = target.current?.getBoundingClientRect();
      if (!outer || !inner) return { x: 0, y: 0 };
      return { x: inner.left - outer.left + inner.width / 2 + dx, y: inner.top - outer.top + inner.height / 2 + dy };
    };
    const move = (target: RefObject<HTMLElement | null>, dx = 0, dy = 0) =>
      setDemo((s) => ({ ...s, cursor: point(target, dx, dy) }));
    const click = (target: RefObject<HTMLElement | null>, patch: Partial<DemoState> = {}) =>
      setDemo((s) => ({ ...s, ...patch, ripple: { ...point(target), n: (s.ripple?.n ?? 0) + 1 } }));

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDemo({ ...START, open: true, recording: true, steps: [stepType, stepClick], typed: TYPED });
      onPhase(2);
      return;
    }

    const play = () => {
      timers.splice(0).forEach(clearTimeout);
      setDemo({
        ...START,
        open: desktop,
        cursor: { x: (box.current?.clientWidth ?? 0) * 0.58, y: (box.current?.clientHeight ?? 0) * 0.62 },
      });
      onPhase(1);
      const opener = desktop ? finish : pin;
      at(500, () => move(opener, 4, 6));
      at(1300, () => click(opener, { open: true, recording: true }));
      at(2100, () => {
        onPhase(2);
        move(field, 10, 6);
      });
      at(2900, () => click(field, { mark: 'field' }));
      [...TYPED].forEach((_, i) => {
        at(3200 + i * 45, () => setDemo((s) => ({ ...s, typed: TYPED.slice(0, i + 1) })));
      });
      at(3900, () => setDemo((s) => ({ ...s, mark: null, steps: [stepType], plus: point(field, 40, -26) })));
      at(4500, () => {
        setDemo((s) => ({ ...s, plus: null }));
        move(button, 6, 6);
      });
      at(5300, () => click(button, { mark: 'button', steps: [stepType, stepClick], plus: point(button, 40, -26) }));
      at(6000, () => {
        setDemo((s) => ({ ...s, mark: null, plus: null }));
        move(finish, 4, 4);
      });
      at(6800, () => {
        click(finish, { guide: true, recording: false });
        onPhase(3);
      });
      at(LOOP_MS, play);
    };
    play();
    return () => timers.forEach(clearTimeout);
  }, [desktop, onPhase, stepType, stepClick]);

  const count = demo.steps.length;
  const counted = i18n.t(count === 1 ? 'recording.recording' : 'recording.recordingPlural', [String(count)]);
  const dot = `size-1.5 shrink-0 rounded-full ${demo.recording ? 'animate-pulse bg-destructive' : 'bg-gray-400'}`;
  const markRing =
    'after:absolute after:-inset-[5px] after:rounded-lg after:border-2 after:border-dashed after:border-mascot';

  return (
    <div
      ref={box}
      aria-hidden="true"
      className="relative aspect-video w-full overflow-hidden rounded-xl bg-gradient-to-b from-lavender/50 to-secondary text-left text-[11px]"
    >
      <div className="absolute inset-x-[4%] top-[5%] flex h-[9%] items-center gap-2 rounded-t-lg border-b border-gray-200 bg-white px-2.5">
        <span className="flex gap-1">
          <i className="size-1.5 rounded-full bg-gray-300" />
          <i className="size-1.5 rounded-full bg-gray-300" />
          <i className="size-1.5 rounded-full bg-gray-300" />
        </span>
        {desktop ? (
          <span className="flex-1 text-center text-[10px] font-semibold text-muted-foreground">
            {i18n.t('onboarding.demoApp')}
          </span>
        ) : (
          <>
            <span className="h-2.5 flex-1 rounded-full bg-gray-100" />
            <span ref={pin} className="flex h-[18px] w-[22px] items-center justify-center rounded-[5px]">
              <MascotIcon size={18} />
            </span>
          </>
        )}
      </div>

      <div className="absolute inset-x-[4%] top-[14%] bottom-0 flex flex-col gap-[5%] bg-white px-[5%] py-[4%]">
        <b className="text-[13px] text-foreground">{i18n.t('onboarding.demoTitle')}</b>
        <span className="block h-[7px] w-[60%] rounded-full bg-lavender/60" />
        <span
          ref={field}
          className={`relative flex h-6 w-[52%] items-center gap-2 rounded-md border border-gray-300 px-2 text-[10px] ${demo.mark === 'field' ? markRing : ''}`}
        >
          <span className="text-muted-foreground">{i18n.t('onboarding.demoField')}</span>
          <span className="text-foreground">{demo.typed}</span>
        </span>
        <span
          ref={button}
          className={`relative self-start rounded-md bg-primary px-3 py-1.5 text-[10px] font-semibold text-white ${demo.mark === 'button' ? markRing : ''}`}
        >
          {i18n.t('onboarding.demoButton')}
        </span>
        <span className="block h-[7px] w-[45%] rounded-full bg-lavender/60" />
      </div>

      {desktop ? (
        <div className="absolute right-[5%] bottom-[6%] z-[2] flex w-[36%] flex-col overflow-hidden rounded-xl border border-lavender bg-white text-[9px] shadow-[0_12px_28px_rgba(30,27,75,0.22)]">
          <div className="flex items-center gap-1.5 border-b border-secondary px-2 py-1.5 text-[9.5px] font-semibold whitespace-nowrap">
            <span className={dot} />
            <span className="mr-auto">{demo.recording || count ? counted : i18n.t('desktop.armed')}</span>
            <span className="rounded-full bg-secondary px-1.5 text-[8px]">{i18n.t('desktop.modeWindow')}</span>
          </div>
          <div className="px-2 pt-1.5">
            {count === 0 ? (
              <div className="flex items-center gap-2 font-medium">
                <MascotIcon size={28} />
                <span>{i18n.t(demo.recording ? 'desktop.tipWaiting' : 'desktop.tipArmed')}</span>
              </div>
            ) : (
              <div key={count} className="flex animate-rise flex-col gap-0.5">
                <span className="relative block h-12 rounded-md border border-secondary bg-background">
                  <span className="absolute top-[52%] left-[46%] h-[26%] w-[34%] rounded-[3px] border-[1.5px] border-dashed border-mascot" />
                </span>
                <b className="text-[9.5px] text-foreground">{demo.steps[count - 1]}</b>
                <span className="flex items-center gap-1 text-[8px] text-muted-foreground">
                  <span className="rounded-[3px] bg-primary px-1 text-[6.5px] font-bold tracking-wide text-primary-foreground uppercase">
                    {i18n.t('stepSource.basic')}
                  </span>
                  {i18n.t('export.stepLabel', [String(count)])}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 p-2">
            <span
              ref={finish}
              className="flex-1 rounded-full bg-primary py-1 text-center text-[9.5px] font-semibold text-white"
            >
              {demo.recording || count ? i18n.t('recording.finish') : i18n.t('desktop.startButton')}
            </span>
            <span className="flex size-5 items-center justify-center rounded-full bg-secondary">
              <Mic size={10} />
            </span>
            <span className="flex size-5 items-center justify-center rounded-full bg-secondary">
              {demo.recording ? <Pause size={10} /> : <X size={10} />}
            </span>
            {demo.recording && (
              <span className="flex size-5 items-center justify-center rounded-full bg-secondary">
                <Trash2 size={10} />
              </span>
            )}
          </div>
        </div>
      ) : (
        <div
          className={`absolute top-[14%] right-[4%] bottom-0 flex w-[30%] flex-col gap-[4%] border-l border-gray-200 bg-white p-[3%] transition-transform duration-500 ${
            demo.open ? 'translate-x-0' : 'translate-x-[115%]'
          }`}
        >
          <span className="flex items-center gap-1 self-center rounded-full border border-lavender px-2 py-0.5 text-[9px] font-semibold whitespace-nowrap">
            <span className={dot} />
            {counted}
          </span>
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
            {demo.steps.map((step) => (
              <div key={step} className="animate-rise overflow-hidden rounded-md border border-secondary">
                <span className="block h-[22px] bg-background" />
                <p className="px-1.5 py-1 text-[8px] font-semibold">{step}</p>
              </div>
            ))}
          </div>
          <span
            ref={finish}
            className="mt-auto flex items-center justify-center gap-1 rounded-full bg-primary py-1 text-[9.5px] font-semibold text-white"
          >
            <Check size={10} strokeWidth={3} />
            {i18n.t('recording.finish')}
          </span>
        </div>
      )}

      {demo.plus && (
        <span
          className="pointer-events-none absolute animate-rise rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white"
          style={{ left: demo.plus.x, top: demo.plus.y }}
        >
          {i18n.t('onboarding.demoPlusStep')}
        </span>
      )}

      <div
        className={`absolute inset-x-[14%] top-[8%] bottom-0 flex flex-col gap-1.5 rounded-t-[10px] bg-white px-[5%] py-[4%] shadow-[0_12px_30px_rgba(30,27,75,0.2)] transition-all duration-500 ${
          demo.guide ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
        }`}
      >
        <b className="text-[13px] text-foreground">{i18n.t('onboarding.demoTitle')}</b>
        <small className="text-[9.5px] text-muted-foreground">{i18n.t('onboarding.demoGuideMeta')}</small>
        {[stepType, stepClick].map((step, i) => (
          <div key={step} className="flex items-center gap-2 rounded-lg border border-secondary p-1.5">
            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[8.5px] font-bold text-primary-foreground">
              {i + 1}
            </span>
            <span className="relative h-7 w-[46px] shrink-0 rounded bg-background">
              <span className="absolute top-[45%] left-[40%] h-[30%] w-[40%] rounded-[2px] border-[1.5px] border-dashed border-mascot" />
            </span>
            <p className="text-[9.5px] font-semibold">{step}</p>
          </div>
        ))}
      </div>

      {demo.ripple && (
        <span
          key={demo.ripple.n}
          className="pointer-events-none absolute z-[4] -mt-[13px] -ml-[13px] size-[26px] animate-[ripple_0.45s_ease-out_forwards] rounded-full border-2 border-mascot opacity-0"
          style={{ left: demo.ripple.x, top: demo.ripple.y }}
        />
      )}
      {demo.cursor.x >= 0 && (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          className="pointer-events-none absolute z-[5] transition-[left,top] duration-700 ease-[cubic-bezier(.4,.1,.2,1)]"
          style={{ left: demo.cursor.x, top: demo.cursor.y }}
        >
          <path
            d="M4.04 4.86 10.7 21.2a.5.5 0 0 0 .93-.03l2.4-6.95 6.95-2.4a.5.5 0 0 0 .03-.93L4.86 4.04a.5.5 0 0 0-.82.82Z"
            fill="#fff"
            stroke="#1E1B4B"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}
