/** AbortSignal.any/timeout are absent on some otherwise supported phones.
 * Use AbortController and always remove the timer/listener when a fetch ends. */
export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 25_000): Promise<Response> {
  const controller = new AbortController();
  const upstream = init.signal;
  const abort = () => controller.abort();
  if (upstream?.aborted) abort();
  else upstream?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    upstream?.removeEventListener('abort', abort);
  }
}
