export function getFaviconUrl(url: string, size = 64): string {
  try {
    const full = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(full)}&size=${size}&drop_404_icon=true`;
  } catch {
    return '';
  }
}
