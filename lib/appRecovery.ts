declare global {
  interface Window {
    TTERecovery?: {
      reloadLatest: () => void;
      recover: (error: unknown) => boolean;
      isAssetError: (error: unknown) => boolean;
    };
  }
}
export function reloadLatestApp() {
  if (window.TTERecovery) return window.TTERecovery.reloadLatest();
  const url = new URL(window.location.href);
  url.searchParams.set('_tte_refresh', String(Date.now()));
  window.location.replace(url.href);
}
