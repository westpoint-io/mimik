const NO_FILL_SWATCH = 'linear-gradient(45deg, #FFFFFF 44%, #EF4444 44%, #EF4444 56%, #FFFFFF 56%)';

export function swatchStyle(color: string | undefined) {
  return !color || color === 'transparent' ? { backgroundImage: NO_FILL_SWATCH } : { backgroundColor: color };
}
