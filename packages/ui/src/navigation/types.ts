export type Route =
  | { page: 'library'; category: 'all' | 'starred' | 'trash' }
  | {
      page: 'guide';
      guideId: string;
      stepId?: string;
      tool?: 'annotate' | 'redact' | 'crop' | 'target';
    };
