import {
  eventTarget,
  findFocusableAncestor,
  isControl,
  isMimikElement,
  isNavigatingClick,
} from '@/core/capture/dom/element-utils';
import { shouldInterceptClick } from '@/core/capture/events/click-intercept';

const MOVE_TOLERANCE_PX = 5;
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]';
const ACTIVE_CAPTURE = { capture: true } as const;

interface HeldEvent {
  type: string;
  target: EventTarget;
  init: PointerEventInit;
}

function initOf(e: PointerEvent | MouseEvent): PointerEventInit {
  const pointer = e instanceof PointerEvent;
  return {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: e.view,
    detail: e.detail,
    button: e.button,
    buttons: e.buttons,
    clientX: e.clientX,
    clientY: e.clientY,
    screenX: e.screenX,
    screenY: e.screenY,
    ctrlKey: e.ctrlKey,
    altKey: e.altKey,
    shiftKey: e.shiftKey,
    metaKey: e.metaKey,
    pointerId: pointer ? e.pointerId : 1,
    pointerType: pointer ? e.pointerType : 'mouse',
    isPrimary: pointer ? e.isPrimary : true,
  };
}

function focusAsPressed(target: EventTarget) {
  if (!(target instanceof Element) || !target.isConnected) return;
  const focusable = target.closest(FOCUSABLE);
  if (focusable instanceof HTMLElement) focusable.focus({ preventScroll: true });
  else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

export class PressHold {
  private held: HeldEvent[] = [];
  private holding = false;
  private origin: { x: number; y: number } | null = null;
  private fallback: ReturnType<typeof setTimeout> | undefined;

  readonly listeners: [string, EventListener, AddEventListenerOptions][] = [
    ['pointerdown', this.onPointerDown.bind(this), ACTIVE_CAPTURE],
    ['mousedown', this.onMouseDown.bind(this), ACTIVE_CAPTURE],
    ['pointermove', this.onPointerMove.bind(this), ACTIVE_CAPTURE],
    ['pointerup', this.onRelease.bind(this), ACTIVE_CAPTURE],
    ['mouseup', this.onRelease.bind(this), ACTIVE_CAPTURE],
  ];

  take(): HeldEvent[] {
    clearTimeout(this.fallback);
    const held = this.held;
    this.held = [];
    this.holding = false;
    this.origin = null;
    return held;
  }

  flush() {
    this.replay(this.take());
  }

  replay(events: HeldEvent[]) {
    for (const { type, target, init } of events) {
      const event = type.startsWith('pointer') ? new PointerEvent(type, init) : new MouseEvent(type, init);
      target.dispatchEvent(event);
      if (type === 'mousedown' && !event.defaultPrevented) focusAsPressed(target);
    }
  }

  private hold(e: Event) {
    this.held.push({
      type: e.type,
      target: eventTarget(e) ?? (e.target as EventTarget),
      init: initOf(e as PointerEvent),
    });
    e.stopPropagation();
  }

  private onPointerDown(e: Event) {
    const pe = e as PointerEvent;
    if (this.holding) this.flush();
    if (!pe.isTrusted || pe.pointerType !== 'mouse' || pe.button !== 0) return;
    const raw = eventTarget(pe);
    if (!(raw instanceof Element)) return;
    const control = findFocusableAncestor(raw);
    if (
      control === document.body ||
      control === document.documentElement ||
      !isControl(control) ||
      isMimikElement(control) ||
      isNavigatingClick(control) ||
      !shouldInterceptClick(control, pe)
    )
      return;
    this.holding = true;
    this.origin = { x: pe.clientX, y: pe.clientY };
    this.hold(pe);
  }

  private onMouseDown(e: Event) {
    if (!this.holding || !e.isTrusted) return;
    e.preventDefault();
    this.hold(e);
  }

  private onPointerMove(e: Event) {
    if (!this.holding || !this.origin || !e.isTrusted) return;
    const pe = e as PointerEvent;
    const moved = Math.max(Math.abs(pe.clientX - this.origin.x), Math.abs(pe.clientY - this.origin.y));
    if (moved > MOVE_TOLERANCE_PX) this.flush();
  }

  private onRelease(e: Event) {
    if (!this.holding || !e.isTrusted) return;
    this.hold(e);
    clearTimeout(this.fallback);
    this.fallback = setTimeout(() => this.flush(), 0);
  }
}
