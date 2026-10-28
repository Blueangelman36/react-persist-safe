import { test, before } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

let React, act, createRoot, usePersisted, useDeployVersion;

before(async () => {
  const dom = new JSDOM("<!doctype html><div id=root></div>", { url: "https://app.example.test/" });
  for (const k of ["window", "document", "localStorage", "StorageEvent", "navigator"]) {
    Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = await import("react");
  ({ act } = React);
  ({ createRoot } = await import("react-dom/client"));
  ({ usePersisted, useDeployVersion } = await import("../src/index.js"));
});

function render(Component) {
  const el = document.createElement("div");
  const root = createRoot(el);
  act(() => root.render(React.createElement(Component)));
  return { el, unmount: () => act(() => root.unmount()) };
}

test("mounting over unreadable data writes nothing", () => {
  localStorage.clear();
  localStorage.setItem("log", "{ not json");
  let seen;
  const view = render(() => {
    const [log, , meta] = usePersisted("log", []);
    seen = { log, status: meta.status };
    return null;
  });
  assert.deepEqual(seen, { log: [], status: "unreadable" });
  assert.equal(localStorage.getItem("log"), "{ not json");
  view.unmount();
});

test("set saves, and another tab's change is picked up", () => {
  localStorage.clear();
  let api;
  const view = render(() => {
    const [n, setN] = usePersisted("n", 0);
    api = { n, setN };
    return null;
  });
  act(() => api.setN((x) => x + 1));
  assert.equal(localStorage.getItem("n"), "1");
  act(() => {
    localStorage.setItem("n", "7");
    window.dispatchEvent(new StorageEvent("storage", { key: "n" }));
  });
  assert.equal(api.n, 7);
  view.unmount();
});

test("useDeployVersion says stale when the deployed version differs", async () => {
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ version: "new" }) });
  let result;
  const view = render(() => {
    result = useDeployVersion({ current: "old" });
    return null;
  });
  assert.equal(result.status, "unknown"); // before the first answer
  await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  assert.deepEqual(result, { status: "stale", deployed: "new" });
  view.unmount();
});
