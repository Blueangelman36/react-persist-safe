import { test } from "node:test";
import assert from "node:assert/strict";
import { checkDeployVersion } from "../src/deploy.js";

const answer = (status, body) => async () => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => (typeof body === "string" ? JSON.parse(body) : body),
});

test("same version is current, a different one is stale", async () => {
  assert.equal((await checkDeployVersion({ current: "abc", fetch: answer(200, { version: "abc" }) })).status, "current");
  const stale = await checkDeployVersion({ current: "abc", fetch: answer(200, { version: "def" }) });
  assert.deepEqual(stale, { status: "stale", deployed: "def" });
});

test("anything that is not a clear answer is unknown, never current", async () => {
  const cases = [
    answer(404, {}),
    answer(200, "<!doctype html><html>"), // a single-page-app fallback for a missing file
    answer(200, { nope: 1 }),
    async () => { throw new TypeError("Failed to fetch"); },
  ];
  for (const f of cases) {
    const r = await checkDeployVersion({ current: "abc", fetch: f });
    assert.equal(r.status, "unknown", r.reason);
    assert.ok(r.reason);
  }
});

test("a build that does not know its own version cannot be current", async () => {
  const r = await checkDeployVersion({ current: "", fetch: answer(200, { version: "" }) });
  assert.equal(r.status, "unknown");
});

test("a slow answer times out as unknown", async () => {
  const hang = (_url, { signal }) =>
    new Promise((_, reject) => signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
  const r = await checkDeployVersion({ current: "abc", fetch: hang, timeoutMs: 20 });
  assert.equal(r.status, "unknown");
  assert.match(r.reason, /no answer in 20 ms/);
});

test("the request bypasses caches", async () => {
  let seen;
  await checkDeployVersion({ current: "a", url: "/v.json", fetch: async (url, init) => { seen = { url, init }; return answer(200, { version: "a" })(); } });
  assert.match(seen.url, /^\/v\.json\?t=\d+$/);
  assert.equal(seen.init.cache, "no-store");
});
