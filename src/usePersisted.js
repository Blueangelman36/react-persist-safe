import { useEffect, useMemo, useSyncExternalStore } from "react";
import { createPersisted } from "./store.js";

/**
 * Like useState, kept in localStorage, and safe on a bad day:
 *
 * - nothing is written until `set` or `clear` is called, so mounting can never overwrite data;
 * - a stored value that can't be read is copied to `<key>:unreadable-backup` before the first
 *   write replaces it, and `status` says "unreadable" so the page can tell the user;
 * - a write that fails (quota, storage blocked) keeps the value in memory and sets `error`;
 * - another tab's change is picked up.
 *
 * `fallback` and `options` are read when the key first mounts; change `key` to start over.
 */
export function usePersisted(key, fallback, options) {
  // Keyed on `key` alone on purpose: fallback and options are initial values, like useState's.
  const store = useMemo(() => createPersisted(key, fallback, options), [key]);
  const state = useSyncExternalStore(store.subscribe, store.get, store.get);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onStorage = (e) => {
      if (e.key === key || e.key === null) store.reload();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key, store]);

  return [
    state.value,
    store.set,
    { status: state.status, error: state.error, clear: store.clear, backupKey: store.backupKey },
  ];
}
