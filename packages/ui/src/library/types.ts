export type SortKey = 'recent' | 'oldest' | 'alpha' | 'steps';

export type LibraryDisplay = 'list' | 'grid';

export interface GuidePlace {
  kind: 'site' | 'app';
  name: string;
}
