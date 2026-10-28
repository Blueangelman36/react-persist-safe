import { test } from "node:test";
import assert from "node:assert/strict";
import { deployVersion } from "../src/vite.js";

function build(plugin) {
  const files = [];
  plugin.generateBundle.call({ emitFile: (f) => files.push(f) });
  return { define: plugin.config().define, files };
}

test("the commit being built is the version, and version.json says the same", () => {
  const saved = process.env.GITHUB_SHA;
  process.env.GITHUB_SHA = "0123456789abcdef0123";
  try {
    const { define, files } = build(deployVersion());
    assert.equal(define.__APP_VERSION__, JSON.stringify("0123456789ab"));
    assert.deepEqual(files.map((f) => [f.fileName, JSON.parse(f.source)]), [["version.json", { version: "0123456789ab" }]]);
  } finally {
    if (saved === undefined) delete process.env.GITHUB_SHA;
    else process.env.GITHUB_SHA = saved;
  }
});

test("an explicit version wins; with no commit at all it is the build time", () => {
  assert.equal(build(deployVersion({ version: "1.2.3" })).define.__APP_VERSION__, '"1.2.3"');
  const env = { ...process.env };
  for (const k of ["VERCEL_GIT_COMMIT_SHA", "COMMIT_REF", "CF_PAGES_COMMIT_SHA", "GITHUB_SHA"]) delete process.env[k];
  try {
    assert.match(JSON.parse(build(deployVersion()).define.__APP_VERSION__), /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    Object.assign(process.env, env);
  }
});
