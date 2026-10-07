import { i18n } from '@/core/env';
import { hexToRgb, normalizeHex, rgbToHex } from '@/core/screenshot/color';
import type { CalloutVariant, Step } from './types';

export const CALLOUT_VARIANTS: CalloutVariant[] = ['info', 'warning', 'error', 'success', 'custom'];

const VARIANT_LABEL_KEYS = {
  info: 'blocks.variantInfo',
  warning: 'blocks.variantWarning',
  error: 'blocks.variantError',
  success: 'blocks.variantSuccess',
  custom: 'blocks.variantCustom',
} as const satisfies Record<CalloutVariant, string>;

export function variantLabel(variant: CalloutVariant): string {
  return i18n.t(VARIANT_LABEL_KEYS[variant]);
}

export const DEFAULT_CALLOUT_COLOR = '#4F46E5';

const VARIANT_ACCENTS: Record<CalloutVariant, string> = {
  info: '#4F46E5',
  warning: '#D97706',
  error: '#DC2626',
  success: '#059669',
  custom: DEFAULT_CALLOUT_COLOR,
};

export function isBlock(step: Step): boolean {
  return step.blockType !== undefined;
}

export function actionSteps(steps: Step[]): Step[] {
  return steps.filter((step) => step.blockType === undefined);
}

export function stepNumbers(steps: Step[]): Map<string, number> {
  const numbers = new Map<string, number>();
  let n = 0;
  for (const step of steps) {
    if (step.blockType === undefined) numbers.set(step.id, ++n);
  }
  return numbers;
}

export function calloutAccent(step: Step): string {
  const variant = step.calloutVariant ?? 'info';
  if (variant === 'custom') return normalizeHex(step.calloutColor ?? '') ?? DEFAULT_CALLOUT_COLOR;
  return VARIANT_ACCENTS[variant];
}

export function tint(hex: string, ratio = 0.12): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#FFFFFF';
  const [r, g, b] = rgb.map((channel) => 255 + (channel - 255) * ratio) as [number, number, number];
  return rgbToHex(r, g, b);
}
