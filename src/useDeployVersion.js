import { useEffect, useState } from "react";
import { watchDeployVersion } from "./deploy.js";

/**
 * `{ status, deployed, reason }` for the running build, re-checked when the tab comes back into
 * view. Show a "new version, reload" banner when status is "stale". Before the first answer,
 * and whenever the check fails, status is "unknown".
 */
export function useDeployVersion({ current, url, intervalMs } = {}) {
  const [result, setResult] = useState({ status: "unknown", deployed: null, reason: "not checked yet" });
  useEffect(() => watchDeployVersion({ current, url, intervalMs, onResult: setResult }), [current, url, intervalMs]);
  return result;
}
