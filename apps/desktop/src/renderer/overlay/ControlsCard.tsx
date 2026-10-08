import { CaptureState } from '@mimik/core/capture/machine';
import { i18n } from '@mimik/core/env';
import { AiFailureNotice } from '@mimik/ui';
import { useLayoutEffect, useReducer, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { CardFoot } from './CardFoot';
import { CardHead } from './CardHead';
import { CardIntro } from './CardIntro';
import { CardPrinter } from './CardPrinter';
import { CardStage } from './CardStage';
import { KeyHint } from './KeyHint';
import { advancePrintRun, type PrintRun } from './lib/advance-print-run';
import { ModePicker } from './ModePicker';
import { useOverlayView } from './use-overlay-view';
import { VoiceLine } from './VoiceLine';

const AI_WAIT_MS = 8000;

export function ControlsCard() {
  const view = useOverlayView();
  const [collapsed, setCollapsed] = useState(false);
  const [, repaint] = useReducer((n: number) => n + 1, 0);
  const run = useRef<PrintRun>({
    wasBusy: false,
    printing: false,
    number: 1,
    landedId: null,
    gaveUp: null,
    shotSrc: null,
    filmSrc: null,
    landing: null,
    started: null,
    fired: false,
    arrived: false,
    reset: false,
    shownPercent: 0,
  }).current;
  const aiWait = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLParagraphElement>(null);
  const printer = useRef<HTMLDivElement>(null);
  const photo = useRef<HTMLSpanElement>(null);
  const film = useRef<HTMLSpanElement>(null);
  const aim = useRef<HTMLSpanElement>(null);
  const flyer = useRef<HTMLDivElement>(null);

  const frame = view ? advancePrintRun(run, view, !matchMedia('(prefers-reduced-motion: reduce)').matches) : null;
  const aimed = view && run.printing ? view.print.aim : null;
  const aimShown = aimed !== null && aimed.x >= 0 && aimed.x <= 1 && aimed.y >= 0 && aimed.y <= 1;

  useLayoutEffect(() => {
    if (!view || !frame) return;
    const node = printer.current;
    if (run.reset && node) {
      node.style.transition = 'none';
      node.style.setProperty('--p', '0');
      void node.offsetWidth;
      run.shownPercent = 0;
      run.reset = false;
    }
    const setPercent = (percent: number, ms: number) => {
      if (!node || percent <= run.shownPercent) return;
      node.style.transition = `--p ${ms}ms cubic-bezier(.2,.7,.3,1)`;
      node.style.setProperty('--p', String(percent));
      run.shownPercent = percent;
    };
    if (run.printing) setPercent(view.progress.percent, view.progress.ms);

    if (aimed && aimShown && aim.current && film.current) {
      const width = film.current.clientWidth;
      const height = film.current.clientHeight;
      const shownWidth = Math.max(width, height * aimed.aspect);
      const shownHeight = Math.max(height, width / aimed.aspect);
      aim.current.style.left = `${(width - shownWidth) / 2 + aimed.x * shownWidth}px`;
      aim.current.style.top = `${(height - shownHeight) / 2 + aimed.y * shownHeight}px`;
    }

    if (frame.describing && !aiWait.current) {
      const waited = frame.printedId;
      aiWait.current = setTimeout(() => {
        run.gaveUp = waited;
        aiWait.current = null;
        repaint();
      }, AI_WAIT_MS);
    }
    if (!run.printing && aiWait.current) {
      clearTimeout(aiWait.current);
      aiWait.current = null;
    }

    const target = run.landing;
    if (
      target &&
      run.started !== target.id &&
      node &&
      flyer.current &&
      photo.current &&
      preview.current &&
      stage.current
    ) {
      run.started = target.id;
      setPercent(100, 150);
      const outer = stage.current.getBoundingClientRect();
      const rectIn = (element: Element) => {
        const inner = element.getBoundingClientRect();
        return {
          left: `${inner.left - outer.left}px`,
          top: `${inner.top - outer.top}px`,
          width: `${inner.width}px`,
          height: `${inner.height}px`,
        };
      };
      const from = {
        ...rectIn(photo.current),
        borderRadius: '3px',
        padding: '4px 4px 10px',
        backgroundColor: '#ffffff',
      };
      const to = { ...rectIn(preview.current), borderRadius: '10px', padding: '0px', backgroundColor: '#eef2ff' };
      Object.assign(flyer.current.style, from);
      const fade = node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, delay: 220, fill: 'forwards' });
      const grow = flyer.current.animate([from, to], {
        duration: 420,
        delay: 180,
        easing: 'cubic-bezier(.3,.7,.3,1)',
        fill: 'forwards',
      });
      void grow.finished
        .then(() => {
          run.landing = null;
          run.fired = false;
          run.arrived = true;
          flushSync(repaint);
          grow.cancel();
          fade.cancel();
          setTimeout(() => {
            run.arrived = false;
            repaint();
          }, 320);
        })
        .catch(() => undefined);
    }

    if (title.current && preview.current) {
      const extra =
        title.current.getBoundingClientRect().height - Number.parseFloat(getComputedStyle(title.current).lineHeight);
      preview.current.style.setProperty('--title-extra', `${view.step ? Math.max(0, extra) : 0}px`);
    }
  });

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() =>
      window.mimikOverlay.size(document.body.scrollWidth, document.body.scrollHeight),
    );
    return () => cancelAnimationFrame(id);
  });

  if (!view || !frame) return null;

  const { state, step, busy, starting, mode, shortcuts, narration } = view;
  const armed = state === CaptureState.ARMED;
  const recording = state === CaptureState.RECORDING;
  const paused = state === CaptureState.PAUSED;
  const waiting = recording && !step && !busy;
  const resting = paused && !step && !busy;
  const { capturing } = frame;
  const count = capturing ? run.number - 1 : (step?.number ?? 0);
  const label = starting
    ? i18n.t('desktop.starting')
    : recording
      ? i18n.t(count === 1 ? 'recording.recording' : 'recording.recordingPlural', [String(count)])
      : paused
        ? i18n.t('recording.capturePaused')
        : i18n.t('desktop.armed');
  const introHidden = !(armed || waiting || resting);
  const shortcut = armed ? shortcuts.record : shortcuts.capture;
  const report = () => window.mimikOverlay.size(document.body.scrollWidth, document.body.scrollHeight);

  return (
    <div
      id="card"
      data-state={state}
      data-resting={resting || undefined}
      className={`flex flex-col overflow-hidden border ${
        collapsed
          ? 'w-fit rounded-full border-transparent bg-primary text-white'
          : 'w-[300px] rounded-[14px] border-lavender bg-card text-foreground'
      }`}
    >
      <CardHead
        label={label}
        count={count}
        recording={recording}
        paused={paused}
        collapsed={collapsed}
        mode={mode}
        onCollapse={() => setCollapsed(!collapsed)}
      />
      <div id="body" hidden={collapsed} className="px-3.5 pt-3">
        <CardStage
          stageRef={stage}
          previewRef={preview}
          titleRef={title}
          step={step}
          hidden={armed || !(capturing || step)}
          capturing={capturing}
          paused={paused}
          armed={armed}
          arrived={run.arrived}
          shotSrc={run.shotSrc}
          onShotLoad={report}
        >
          <CardPrinter
            printerRef={printer}
            photoRef={photo}
            filmRef={film}
            aimRef={aim}
            hidden={!capturing}
            number={run.number}
            filmSrc={run.filmSrc}
            developing={frame.developing}
            fired={run.fired}
            aimed={aimShown}
          />
          <div
            id="flyer"
            ref={flyer}
            hidden={!run.landing}
            className="absolute z-[3] overflow-hidden border border-lavender/50 shadow-[0_4px_10px_rgba(30,27,75,0.14)]"
          >
            <img src={run.landing?.src} alt="" className="block size-full object-contain" />
          </div>
        </CardStage>
        <CardIntro
          hidden={introHidden}
          waiting={waiting || resting}
          resting={resting}
          tip={i18n.t(armed ? 'desktop.tipArmed' : resting ? 'desktop.tipPaused' : 'desktop.tipWaiting')}
        />
        <KeyHint
          hidden={introHidden || resting || !shortcut || Boolean(narration)}
          shortcut={shortcut ?? ''}
          messageKey={armed ? 'desktop.hintStartStop' : 'desktop.hintCapture'}
        />
        <VoiceLine narration={narration} hidden={collapsed || !narration} hintHidden={introHidden} />
      </div>
      <ModePicker hidden={collapsed || !paused} mode={mode} />
      <div id="aiNotice" hidden={collapsed || armed || !view.aiFailure}>
        <AiFailureNotice failure={view.aiFailure} />
      </div>
      <CardFoot state={state} hidden={collapsed} starting={starting} busy={busy} />
    </div>
  );
}
