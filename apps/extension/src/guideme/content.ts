import { logger } from '@mimik/core/logger';
import { browser } from '#imports';
import { findElement } from '@/core/guideme/finder';
import type { GuideMeSession } from '@/core/guideme/session';
import { BLOCKED_KEY, MANUAL_KEY, SESSION_KEY, STEP_KEY } from '@/core/guideme/session';
import type { Step } from '@/core/guides/types';
import { sendMessage } from '@/lib/messaging';
import { GuideMeOverlay } from './guide-me-overlay';

const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 1000;

export class GuideMeController {
  private overlay: GuideMeOverlay | null = null;
  private storageListener: ((changes: Record<string, { newValue?: unknown }>) => void) | null = null;
  private clickHandler: ((e: Event) => void) | null = null;
  private clickEvent: 'click' | 'change' = 'click';
  private currentTarget: HTMLElement | null = null;
  private currentStepIndex = -1;
  private watchTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (window.self !== window.top) return;
    this.storageListener = (changes) => {
      if (changes[SESSION_KEY] || changes[STEP_KEY]) {
        this.onStorageChange();
      }
    };
    browser.storage.local.onChanged.addListener(this.storageListener);
    this.checkForActiveSession();
  }

  dispose() {
    if (this.storageListener) {
      browser.storage.local.onChanged.removeListener(this.storageListener);
      this.storageListener = null;
    }
    this.stopWatching();
    this.removeActionDetection();
    this.destroyOverlay();
  }

  private async checkForActiveSession() {
    const data = await browser.storage.local.get([SESSION_KEY, STEP_KEY, MANUAL_KEY]);
    const session = data[SESSION_KEY] as GuideMeSession | null;
    const step = data[STEP_KEY] as Step | null;
    if (session?.active && step) {
      this.showStep(step, session.activeStepIndex, data[MANUAL_KEY] === true);
    }
  }

  private async onStorageChange() {
    const data = await browser.storage.local.get([SESSION_KEY, STEP_KEY, MANUAL_KEY]);
    const session = data[SESSION_KEY] as GuideMeSession | null;
    const step = data[STEP_KEY] as Step | null;

    if (!session?.active || !step) {
      this.stopWatching();
      this.removeActionDetection();
      this.destroyOverlay();
      return;
    }

    this.showStep(step, session.activeStepIndex, data[MANUAL_KEY] === true);
  }

  private showStep(step: Step, stepIndex: number, requiresManual: boolean) {
    this.removeActionDetection();
    this.destroyOverlay();
    this.stopWatching();
    this.currentStepIndex = stepIndex;

    const meta = step.elementMeta;
    if (!meta || requiresManual) {
      this.setBlocked(stepIndex);
      return;
    }

    let attempts = 0;
    const attach = () => {
      const { element } = findElement(meta);
      if (!element) {
        attempts += 1;
        if (attempts === MAX_RETRIES) this.setBlocked(stepIndex);
        return;
      }
      this.stopWatching();
      this.setBlocked(null);
      this.overlay = new GuideMeOverlay();
      this.overlay.show(step.description, stepIndex + 1, element);
      this.setupActionDetection(step, element);
    };

    attach();
    if (!this.overlay) this.watchTimer = setInterval(attach, RETRY_INTERVAL_MS);
  }

  private setBlocked(stepIndex: number | null) {
    browser.storage.local
      .set({ [BLOCKED_KEY]: stepIndex })
      .catch((err) => logger.warn('Failed to flag guide me roadblock', err));
  }

  private stopWatching() {
    if (this.watchTimer) clearInterval(this.watchTimer);
    this.watchTimer = null;
  }

  private setupActionDetection(step: Step, target: HTMLElement) {
    this.currentTarget = target;

    if (step.action === 'input' && !step.inputValue) {
      this.clickHandler = () => this.advanceStep();
      this.clickEvent = 'change';
      target.addEventListener('change', this.clickHandler, { once: true });
      return;
    }

    if (step.action === 'input' && step.inputValue) {
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        const proto =
          target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (nativeSetter) nativeSetter.call(target, step.inputValue);
        else target.value = step.inputValue;
      } else if (target.getAttribute('contenteditable') !== null) {
        target.textContent = step.inputValue;
      }
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      setTimeout(() => this.advanceStep(), 500);
      return;
    }

    this.clickHandler = () => this.advanceStep();
    this.clickEvent = 'click';
    target.addEventListener('click', this.clickHandler, { once: true });
  }

  private advanceStep() {
    sendMessage('guideMeStepCompleted', { stepIndex: this.currentStepIndex }).catch((err) =>
      logger.warn('Failed to advance guide me step', err),
    );
  }

  private removeActionDetection() {
    if (this.clickHandler && this.currentTarget) {
      this.currentTarget.removeEventListener(this.clickEvent, this.clickHandler);
    }
    this.clickHandler = null;
    this.currentTarget = null;
  }

  private destroyOverlay() {
    this.overlay?.destroy();
    this.overlay = null;
  }
}
