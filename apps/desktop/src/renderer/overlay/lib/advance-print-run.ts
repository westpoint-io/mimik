import type { OverlayView } from '../../../main/overlay';

export interface PrintRun {
  wasBusy: boolean;
  printing: boolean;
  number: number;
  landedId: string | null;
  gaveUp: string | null;
  shotSrc: string | null;
  filmSrc: string | null;
  landing: { src: string; id: string } | null;
  started: string | null;
  fired: boolean;
  arrived: boolean;
  reset: boolean;
  shownPercent: number;
}

export interface PrintFrame {
  capturing: boolean;
  developing: boolean;
  describing: boolean;
  printedId: string | null;
}

export function advancePrintRun(run: PrintRun, view: OverlayView, animate: boolean): PrintFrame {
  const { busy, step, print } = view;
  if (busy && !run.wasBusy) {
    run.number = (step?.number ?? 0) + 1;
    if (step) run.landedId = step.id;
    run.reset = true;
    run.printing = true;
  }
  run.wasBusy = busy;

  const printed = step && step.number >= run.number ? step : null;
  const developed = printed?.src ?? print.src;
  if (run.printing && developed) run.filmSrc = developed;
  const developing = run.printing && Boolean(developed);
  const describing = run.printing && !busy && printed?.pending === true && run.gaveUp !== printed.id;

  if (run.printing && !busy && !describing) {
    run.printing = false;
    if (printed?.src && printed.id !== run.landedId) {
      run.landedId = printed.id;
      if (animate) {
        run.landing = { src: printed.src, id: printed.id };
        run.fired = true;
      }
    }
  }
  if (!run.printing && !run.landing) run.landedId = step?.id ?? null;

  const capturing = run.printing || run.landing !== null;
  if (step && !capturing) run.shotSrc = step.src;
  return { capturing, developing, describing, printedId: printed?.id ?? null };
}
