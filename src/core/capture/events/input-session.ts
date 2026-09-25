import { i18n } from '#imports';
import { logger } from '@/lib/logger';
import { sendMessage } from '@/lib/messaging';
import { extractDOMContext } from '../dom/context';
import { extractElementMeta, type FrozenRect, freezeRect } from '../dom/element-meta';
import { getFieldLabel, getFieldValue, isRedactedField, isSensitiveField } from '../dom/element-utils';
import { locateFrame, placeInTab } from '../dom/frame-placement';

export class InputSession {
  stepId: string | null = null;
  target: HTMLElement | null = null;

  private guideId: string;
  private atEvent: FrozenRect | undefined;

  constructor(guideId: string) {
    this.guideId = guideId;
  }

  get active() {
    return this.stepId !== null;
  }

  async start(target: HTMLElement, atEvent?: FrozenRect) {
    this.atEvent = atEvent;
    const placement = locateFrame();
    const elementMeta = extractElementMeta(target, atEvent);
    const res = await sendMessage('captureStep', {
      guideId: this.guideId,
      action: 'input',
      elementMeta: placeInTab(elementMeta, await placement),
      domContext: extractDOMContext(target, 'input'),
    });
    if ('stepId' in res) {
      this.stepId = res.stepId;
      this.target = target;
    }
  }

  update(target: HTMLElement) {
    if (!this.stepId) return;
    this.atEvent = freezeRect(target);
    const label = getFieldLabel(target);
    if (isSensitiveField(target) || isRedactedField(target)) {
      const description = isSensitiveField(target) ? i18n.t('steps.typeSecret') : i18n.t('steps.typeInto', [label]);
      sendMessage('updateInputStep', { stepId: this.stepId, description }).catch((err) =>
        logger.warn('Failed to update input step', err),
      );
      return;
    }
    const val = getFieldValue(target);
    const desc = val ? `Type "${val}" in ${label}` : `Clear ${label}`;
    sendMessage('updateInputStep', { stepId: this.stepId, description: desc, inputValue: val || undefined }).catch(
      (err) => logger.warn('Failed to update input step', err),
    );
  }

  async finalize() {
    if (!this.target || !this.stepId) return;
    const target = this.target;
    const stepId = this.stepId;
    const atEvent = this.atEvent;
    this.stepId = null;
    this.target = null;
    this.atEvent = undefined;
    const placement = locateFrame();
    const elementMeta = extractElementMeta(target, atEvent);
    await sendMessage('finalizeInputStep', {
      stepId,
      elementMeta: placeInTab(elementMeta, await placement),
      domContext: extractDOMContext(target, 'input'),
    });
  }
}
