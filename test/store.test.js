import { test } from "node:test";
import assert from "node:assert/strict";
import { createPersisted } from "../src/store.js";
import { MemoryStorage } from "./memory-storage.js";

test("reading never writes, whatever the read found", () => {
  for (const entries of [{}, { log: "[1,2]" }, { log: "{ not json" }]) {
    const storage = new MemoryStorage(entries);
    createPersisted("log", [], { storage });
    assert.equal(storage.writes, 0);
  }
});

test("a stored value is loaded", () => {
  const p = createPersisted("log", [], { storage: new MemoryStorage({ log: "[1,2]" }) });
  assert.deepEqual(p.get(), { value: [1, 2], status: "loaded", error: null, stored: true });
});

test("nothing stored is 'missing', and the fallback is used", () => {
  const p = createPersisted("log", ["start"], { storage: new MemoryStorage() });
  assert.equal(p.get().status, "missing");
  assert.deepEqual(p.get().value, ["start"]);
});

test("an unreadable value is copied aside before the first write replaces it", () => {
  const storage = new MemoryStorage({ log: "{ not json" });
  const p = createPersisted("log", [], { storage });
  assert.equal(p.get().status, "unreadable");
  p.set([3]);
  assert.equal(storage.getItem("log:unreadable-backup"), "{ not json");
  assert.equal(storage.getItem("log"), "[3]");
  // A second write must not replace the backup with the value we just wrote.
  p.set([4]);
  assert.equal(storage.getItem("log:unreadable-backup"), "{ not json");
});

test("validate() failing counts as unreadable, not as missing", () => {
  const storage = new MemoryStorage({ log: '{"a":1}' });
  const p = createPersisted("log", [], { storage, validate: Array.isArray });
  assert.equal(p.get().status, "unreadable");
  assert.match(p.get().error, /validate/);
});

test("blocked storage is 'unavailable', and changes still work in memory", () => {
  const storage = new MemoryStorage({ log: "[1]" });
  storage.failReads = true;
  const p = createPersisted("log", [], { storage });
  assert.equal(p.get().status, "unavailable");
  p.set([9]);
  assert.deepEqual(p.get().value, [9]);
  assert.ok(p.get().error);
  // Reads failed but writes might not: what is stored was never seen, so it is left alone.
  assert.equal(storage.map.get("log"), "[1]");
});

test("no storage at all is 'unavailable'", () => {
  const p = createPersisted("log", [], { storage: null });
  assert.equal(p.get().status, "unavailable");
  assert.equal(p.set([1]), false);
  assert.deepEqual(p.get().value, [1]);
});

test("a write that fails keeps the value in memory and says it was not saved", () => {
  const storage = new MemoryStorage();
  const p = createPersisted("log", [], { storage });
  storage.failWrites = true;
  assert.equal(p.set([1]), false);
  assert.deepEqual(p.get().value, [1]);
  assert.match(p.get().error, /not saved/);
});

test("refuseEmpty: an empty value may replace a stored one only through clear()", () => {
  const storage = new MemoryStorage({ notes: '"three pages of notes"' });
  const p = createPersisted("notes", "", { storage, refuseEmpty: true });
  assert.equal(p.set(""), false);
  assert.equal(storage.getItem("notes"), '"three pages of notes"');
  assert.equal(p.clear(), true);
  assert.equal(storage.getItem("notes"), '""');
});

test("set takes an updater, like useState", () => {
  const p = createPersisted("n", 0, { storage: new MemoryStorage() });
  p.set((n) => n + 1);
  p.set((n) => n + 1);
  assert.equal(p.get().value, 2);
});

test("subscribers hear about changes and reloads", () => {
  const storage = new MemoryStorage();
  const p = createPersisted("n", 0, { storage });
  let calls = 0;
  const stop = p.subscribe(() => (calls += 1));
  p.set(1);
  storage.setItem("n", "5");
  p.reload();
  assert.equal(p.get().value, 5);
  assert.equal(calls, 2);
  stop();
  p.set(2);
  assert.equal(calls, 2);
});
