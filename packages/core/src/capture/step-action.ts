export type StepAction =
  | 'click'
  | 'auxclick'
  | 'input'
  | 'copy'
  | 'paste'
  | 'cut'
  | 'drag'
  | 'navigate'
  | `keydown:${string}`;
