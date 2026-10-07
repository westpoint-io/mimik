import { DEFAULT_FONT_SIZE, DEFAULT_LINE_HEIGHT, type FontFamily } from '@mimik/core/screenshot/types';
import { useState } from 'react';

interface TextStyle {
  fontFamily: FontFamily;
  bold: boolean;
  italic: boolean;
  fontSize: number;
  lineHeight: number;
}

export interface TextStyleState extends TextStyle {
  setFontFamily: (next: FontFamily) => void;
  setBold: (next: boolean) => void;
  setItalic: (next: boolean) => void;
  setFontSize: (next: number) => void;
  setLineHeight: (next: number) => void;
  apply: (patch: Partial<TextStyle>) => void;
}

export function useTextStyle(): TextStyleState {
  const [fontFamily, setFontFamily] = useState<FontFamily>('sans-serif');
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [lineHeight, setLineHeight] = useState(DEFAULT_LINE_HEIGHT);

  const apply = (patch: Partial<TextStyle>) => {
    if (patch.fontFamily) setFontFamily(patch.fontFamily);
    if (patch.bold !== undefined) setBold(patch.bold);
    if (patch.italic !== undefined) setItalic(patch.italic);
    if (patch.fontSize !== undefined) setFontSize(patch.fontSize);
    if (patch.lineHeight !== undefined) setLineHeight(patch.lineHeight);
  };

  return {
    fontFamily,
    bold,
    italic,
    fontSize,
    lineHeight,
    setFontFamily,
    setBold,
    setItalic,
    setFontSize,
    setLineHeight,
    apply,
  };
}
