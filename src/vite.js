/**
 * Vite plugin: gives the build a version, and writes it where the page can ask for it.
 *
 *   // vite.config.js
 *   import { deployVersion } from "react-persist-safe/vite";
 *   export default { plugins: [deployVersion()] };
 *
 * - defines `__APP_VERSION__` in your code;
 * - emits `version.json` (`{"version": "..."}`) next to index.html.
 *
 * The version is the commit Vercel, Netlify, Cloudflare Pages or GitHub Actions is building, or
 * the build time when there is none, so every deploy gets a new one without anyone bumping it.
 */
export function deployVersion({ version, fileName = "version.json" } = {}) {
  const env = globalThis.process?.env ?? {};
  const commit = (env.VERCEL_GIT_COMMIT_SHA || env.COMMIT_REF || env.CF_PAGES_COMMIT_SHA || env.GITHUB_SHA || "").slice(0, 12);
  const resolved = version ?? (commit || new Date().toISOString());
  return {
    name: "react-persist-safe:deploy-version",
    config() {
      return { define: { __APP_VERSION__: JSON.stringify(resolved) } };
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName, source: JSON.stringify({ version: resolved }) + "\n" });
    },
  };
}
