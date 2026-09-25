import { isTextField, isToggle } from '../dom/element-utils';

const MENU_SELECTOR = '[role="menu"], [role="menubar"]';

const replayed = new WeakSet<Event>();

export function isReplayedClick(event: Event): boolean {
  return replayed.has(event);
}

export function shouldInterceptClick(target: HTMLElement, event: MouseEvent): boolean {
  if (!event.isTrusted || event.shiftKey) return false;
  if (target instanceof HTMLSelectElement || target instanceof HTMLOptionElement) return false;
  if (target.isContentEditable) return false;
  if (isToggle(target) && !target.closest(MENU_SELECTOR)) return false;
  return !isTextField(target);
}

export function replayInit(event: MouseEvent): PointerEventInit {
  return {
    bubbles: true,
    cancelable: true,
    composed: true,
    detail: event.detail,
    button: event.button,
    buttons: event.buttons,
    clientX: event.clientX,
    clientY: event.clientY,
    screenX: event.screenX,
    screenY: event.screenY,
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
    metaKey: event.metaKey,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
  };
}

export function replayClick(target: HTMLElement, init: PointerEventInit): void {
  if (target.isConnected && target.tabIndex >= 0) target.focus();
  const event = new PointerEvent('click', init);
  replayed.add(event);
  target.dispatchEvent(event);
}
