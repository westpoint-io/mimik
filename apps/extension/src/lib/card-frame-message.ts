export type CardFrameMessage =
  | { mimikCard: 'size'; width: number; height: number }
  | { mimikCard: 'move'; dx: number; dy: number }
  | { mimikCard: 'drop' }
  | { mimikCard: 'close' };
