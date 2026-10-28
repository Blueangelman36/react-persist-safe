/**
 * Is the code in this tab the code that is deployed?
 *
 * A single-page app keeps running the bundle it loaded, sometimes for days in a phone's
 * background tab, while new versions ship underneath it. When the server's API moves on, the
 * old page calls it the old way and draws what comes back wrongly, or fails in ways no one can
 * reproduce. The fix is cheap: the build writes its version into a small file, the page asks
 * for that file now and then, and says "a new version is available, reload" when they differ.
 *
 * Three answers, kept apart: "current", "stale", and "unknown". A failed request is unknown,
 * never current: offline is not up to date.
 */

/**
 * @param {{ url?: string, current: string, fetch?: typeof fetch, timeoutMs?: number }} options
 * @returns {Promise<{ status: "current" | "stale" | "unknown", deployed: string | null, reason?: string }>}
 */
export async function checkDeployVersion({ url = "/version.json", current, fetch: f = globalThis.fetch, timeoutMs = 10_000 }) {
  if (!current) return { status: "unknown", deployed: null, reason: "this build does not know its own version" };
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    // The query string and no-store both, because some CDNs and service workers ignore one.
    const sep = url.includes("?") ? "&" : "?";
    const response = await f(`${url}${sep}t=${Date.now()}`, { cache: "no-store", signal: controller?.signal });
    if (!response.ok) return { status: "unknown", deployed: null, reason: `HTTP ${response.status}` };
    let body;
    try {
      body = await response.json();
    } catch {
      // An HTML page here usually means a single-page-app fallback served for a missing file.
      return { status: "unknown", deployed: null, reason: "the version file is not JSON (is it deployed?)" };
    }
    const deployed = typeof body?.version === "string" ? body.version : null;
    if (!deployed) return { status: "unknown", deployed: null, reason: "the version file has no version" };
    return { status: deployed === current ? "current" : "stale", deployed };
  } catch (e) {
    const reason = e?.name === "AbortError" ? `no answer in ${timeoutMs} ms` : String(e?.message ?? e);
    return { status: "unknown", deployed: null, reason };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Check when the tab comes back into view, and every `intervalMs` while it is visible.
 * Returns a function that stops watching.
 *
 * @param {{ url?: string, current: string, intervalMs?: number, onResult: (r: Awaited<ReturnType<typeof checkDeployVersion>>) => void, fetch?: typeof fetch }} options
 */
export function watchDeployVersion({ intervalMs = 15 * 60_000, onResult, ...check }) {
  let stopped = false;
  let busy = false;
  const run = async () => {
    const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
    if (stopped || busy || hidden) return;
    busy = true;
    try {
      const result = await checkDeployVersion(check);
      if (!stopped) onResult(result);
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(run, intervalMs);
  const onVisible = () => run();
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisible);
  run();
  return () => {
    stopped = true;
    clearInterval(timer);
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisible);
  };
}
