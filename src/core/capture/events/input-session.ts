import { logger } from '@/lib/logger';
import { sendMessage } from '@/lib/messaging';
import { extractDOMContext } from '../dom/context';
import { extractElementMeta, type FrozenRect, freezeRect } from '../dom/element-meta';
import { getFieldLabel, getFieldValue } from '../dom/element-utils';
import { frameOffset, translateMeta } from '../dom/frame-offset';

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
    const res = await sendMessage('captureStep', {
      guideId: this.guideId,
      action: 'input',
      elementMeta: translateMeta(extractElementMeta(target, atEvent), await frameOffset()),
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
    const val = getFieldValue(target);
    const desc = val ? `Type "${val}" in ${getFieldLabel(target)}` : `Clear ${getFieldLabel(target)}`;
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
    await sendMessage('finalizeInputStep', {
      stepId,
      elementMeta: translateMeta(extractElementMeta(target, atEvent), await frameOffset()),
      domContext: extractDOMContext(target, 'input'),
    });
  }
}
