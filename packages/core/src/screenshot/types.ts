import type { ScreenshotBounds } from '@/core/guides/types';

export type TargetBorder = 'dashed' | 'solid';

export const TARGET_COLORS = [
  '#4F46E5',
  '#F43F5E',
  '#EC4899',
  '#A855F7',
  '#3B82F6',
  '#14B8A6',
  '#22C55E',
  '#EAB308',
] as const;

export const DEFAULT_TARGET_COLOR = '#4F46E5';

export interface ClickTarget extends ScreenshotBounds {
  border: TargetBorder;
  color: string;
}

export type LineWidth = 'none' | 'xs' | 'sm' | 'ms' | 'md' | 'ml' | 'lg' | 'xl';

export const LINE_WIDTHS: Record<LineWidth, number> = {
  none: 0,
  xs: 1,
  sm: 2,
  ms: 3,
  md: 5,
  ml: 7,
  lg: 10,
  xl: 14,
};

export const LINE_WIDTH_ORDER: LineWidth[] = ['none', 'xs', 'sm', 'ms', 'md', 'ml', 'lg', 'xl'];

export type FontFamily = 'sans-serif' | 'serif' | 'monospace';
export const FONT_FAMILIES: Record<FontFamily, string> = {
  'sans-serif': 'Poppins, sans-serif',
  serif: 'Georgia, serif',
  monospace: 'ui-monospace, monospace',
};

export const FONT_FAMILY_ORDER: FontFamily[] = ['sans-serif', 'serif', 'monospace'];

export const DEFAULT_FONT_SIZE = 32;
export const MIN_FONT_SIZE = 8;
export const MAX_FONT_SIZE = 200;
export const DEFAULT_LINE_HEIGHT = 1.4;
export const MIN_LINE_HEIGHT = 0.8;
export const MAX_LINE_HEIGHT = 3;

export type ArrowEnd = 'none' | 'bar' | 'arrow' | 'arrow-solid' | 'circle' | 'circle-solid' | 'square' | 'square-solid';

export const ARROW_ENDS: ArrowEnd[] = [
  'none',
  'bar',
  'arrow',
  'arrow-solid',
  'circle',
  'circle-solid',
  'square',
  'square-solid',
];

export const SHAPE_COLORS = [
  'transparent',
  '#FFFFFF',
  '#D4D4D8',
  '#71717A',
  '#000000',
  '#1E1B4B',
  '#2563EB',
  '#7DD3FC',
  '#2DD4BF',
  '#059669',
  '#22C55E',
  '#FACC15',
  '#F97316',
  '#EF4444',
  '#831843',
  '#EC4899',
  '#A855F7',
] as const;

export type Annotation =
  | {
      id: string;
      type: 'box';
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
      fill?: string;
      lineWidth?: LineWidth;
      radius?: number;
    }
  | {
      id: string;
      type: 'ellipse';
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
      fill?: string;
      lineWidth?: LineWidth;
    }
  | {
      id: string;
      type: 'arrow';
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: string;
      lineWidth?: LineWidth;
      end?: ArrowEnd;
    }
  | {
      id: string;
      type: 'text';
      x: number;
      y: number;
      text: string;
      color: string;
      size: number;
      w?: number;
      h?: number;
      fontFamily?: FontFamily;
      bold?: boolean;
      italic?: boolean;
      lineHeight?: number;
    }
  | { id: string; type: 'freehand'; points: number[]; color: string; lineWidth?: LineWidth }
  | { id: string; type: 'redact'; x: number; y: number; w: number; h: number; style: 'blur' | 'solid' }
  | { id: string; type: 'target'; x: number; y: number; w: number; h: number; color: string; border: TargetBorder };

export type CursorStyle = 'arrow' | 'hand' | 'dot';

export interface CursorMark {
  x: number;
  y: number;
  style: CursorStyle;
  scale: number;
}

export interface ScreenshotEdits {
  viewport?: ScreenshotBounds;
  zoomLevel?: number;
  zoomAuto?: boolean;
  target?: ClickTarget | null;
  annotations?: Annotation[];
  cursor?: CursorMark | null;
  alt?: string;
}
