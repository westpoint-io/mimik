import { logger } from '@mimik/core/logger';
import { i18n } from '#imports';
import { extractDOMContext } from '@/core/capture/dom/context';
import { extractElementMeta, type FrozenRect, freezeRect } from '@/core/capture/dom/element-meta';
import { getFieldLabel, getFieldValue, isRedactedField, isSensitiveField } from '@/core/capture/dom/element-utils';
import type { CaptureSink } from '@/core/capture/sink';

export class InputSession {
  stepId: string | null = null;
  target: HTMLElement | null = null;

  private guideId: string;
  private atEvent: FrozenRect | undefined;

  constructor(
    guideId: string,
    private sink: CaptureSink,
  ) {
    this.guideId = guideId;
  }

  get active() {
    return this.stepId !== null;
  }

  async start(target: HTMLElement, atEvent?: FrozenRect) {
    this.atEvent = atEvent;
    const res = await this.sink.captureStep({
      guideId: this.guideId,
      action: 'input',
      elementMeta: extractElementMeta(target, atEvent),
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
      this.sink
        .updateInputStep({ stepId: this.stepId, description })
        .catch((err) => logger.warn('Failed to update input step', err));
      return;
    }
    const val = getFieldValue(target);
    const desc = val ? `Type "${val}" in ${label}` : `Clear ${label}`;
    this.sink
      .updateInputStep({ stepId: this.stepId, description: desc, inputValue: val || undefined })
      .catch((err) => logger.warn('Failed to update input step', err));
  }

  async finalize() {
    if (!this.target || !this.stepId) return;
    const target = this.target;
    const stepId = this.stepId;
    const atEvent = this.atEvent;
    this.stepId = null;
    this.target = null;
    this.atEvent = undefined;
    await this.sink.finalizeInputStep({
      stepId,
      elementMeta: extractElementMeta(target, atEvent),
      domContext: extractDOMContext(target, 'input'),
    });
  }
}
