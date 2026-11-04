/* Loaded before the module graph, so even a missing entry chunk can recover.
   Never clear customer records, local tasks, quotations or browser storage. */
(function () {
  var attempted = false;
  var key = 'tte:asset-recovery';
  function reloadLatest() {
    var url = new URL(window.location.href);
    url.searchParams.set('_tte_refresh', String(Date.now()));
    window.location.replace(url.href);
  }
  function isAssetError(error) {
    return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading (CSS )?chunk [\w-]+ failed|ChunkLoadError|Unable to preload CSS/i.test(String(error && (error.message || error)));
  }
  function recover(error) {
    if (!isAssetError(error) || attempted || navigator.onLine === false) return false;
    try {
      var last = Number(sessionStorage.getItem(key) || 0);
      if (last && Date.now() - last < 60000) return false;
      sessionStorage.setItem(key, String(Date.now()));
    } catch { return false; } // No persistent guard: show the recovery UI instead of a reload loop.
    attempted = true;
    reloadLatest();
    return true;
  }
  window.TTERecovery = { reloadLatest: reloadLatest, recover: recover, isAssetError: isAssetError };
  window.addEventListener('vite:preloadError', function (event) {
    if (recover(event.payload)) event.preventDefault();
  });
  window.addEventListener('unhandledrejection', function (event) {
    if (recover(event.reason)) event.preventDefault();
  });
  window.addEventListener('error', function (event) {
    var script = event.target;
    if (!script || script.tagName !== 'SCRIPT' || !script.src) return;
    var url = new URL(script.src, window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/assets/')) return;
    if (!recover(new Error('ChunkLoadError'))) {
      var root = document.getElementById('root');
      if (!root || root.childElementCount) return;
      var message = document.createElement('p');
      message.textContent = 'The CRM could not download its files. Check your connection, then reopen the latest app.';
      var button = document.createElement('button');
      button.textContent = 'Reopen latest CRM';
      button.onclick = reloadLatest;
      root.append(message, button);
    }
  }, true);
}());
