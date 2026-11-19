import { postToPage } from './post-to-page';

export function closeCard(): void {
  if (new URLSearchParams(location.search).has('popup')) window.close();
  else postToPage({ mimikCard: 'close' });
}
