/**
 * One stored value, read once and written only when someone changes it.
 *
 * The bug this exists to prevent, from a workout log that lost its history:
 *
 *     const [v, setV] = useState(() => read(key, fallback));
 *     useEffect(() => { write(key, v); }, [v]);   // also runs on mount
 *
 * The effect runs on mount and writes back whatever useState produced. When the read failed
 * (corrupt JSON, a private window, storage blocked) that is the fallback, and it replaces the
 * real data on the very first render. Nobody pressed anything.
 *
 * So here a write happens only in `set` and `clear`, never as a consequence of reading, and a
 * stored value that could not be read is copied aside before anything replaces it.
 */

/** @typedef {"loaded" | "missing" | "unreadable" | "unavailable"} ReadStatus */

const BACKUP_SUFFIX = ":unreadable-backup";

function defaultStorage() {
  try {
    // Touching localStorage throws in some private windows and when site data is blocked.
    const s = globalThis.localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

function isEmpty(value) {
  if (value == null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

/**
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @param {{
 *   storage?: Storage | null,
 *   validate?: (value: unknown) => boolean,
 *   refuseEmpty?: boolean,
 *   serialize?: (value: T) => string,
 *   deserialize?: (raw: string) => unknown,
 * }} [options]
 */
export function createPersisted(key, fallback, options = {}) {
  const storage = "storage" in options ? options.storage : defaultStorage();
  const validate = options.validate ?? (() => true);
  const serialize = options.serialize ?? JSON.stringify;
  const deserialize = options.deserialize ?? JSON.parse;
  const refuseEmpty = options.refuseEmpty ?? false;
  const listeners = new Set();

  /** @type {{ value: T, status: ReadStatus, error: string | null, stored: boolean }} */
  let state = read();

  function read() {
    if (!storage) return { value: fallback, status: "unavailable", error: "storage is not available here", stored: false };
    let raw;
    try {
      raw = storage.getItem(key);
    } catch (e) {
      return { value: fallback, status: "unavailable", error: String(e?.message ?? e), stored: false };
    }
    if (raw == null) return { value: fallback, status: "missing", error: null, stored: false };
    try {
      const parsed = deserialize(raw);
      if (!validate(parsed)) throw new Error("the stored value did not pass validate()");
      return { value: /** @type {T} */ (parsed), status: "loaded", error: null, stored: true };
    } catch (e) {
      // Something is stored and it is not what we expected. It is still someone's data.
      return { value: fallback, status: "unreadable", error: String(e?.message ?? e), stored: true };
    }
  }

  function emit() {
    for (const l of listeners) l();
  }

  function write(next, { allowEmpty }) {
    // No storage, or a read that threw: whatever is stored was never seen, so it is not ours to
    // replace. The change lives in memory until the page closes.
    if (!storage || state.status === "unavailable") {
      state = { ...state, value: next, error: "storage is not available here; the change lasts until the page closes" };
      emit();
      return false;
    }
    if (!allowEmpty && refuseEmpty && isEmpty(next) && state.stored && !isEmpty(state.value)) {
      state = { ...state, error: "refused to replace a stored value with an empty one; use clear()" };
      emit();
      return false;
    }
    try {
      if (state.status === "unreadable") {
        // Copy the value we could not read aside before the first write replaces it.
        const raw = storage.getItem(key);
        if (raw != null && storage.getItem(key + BACKUP_SUFFIX) == null) storage.setItem(key + BACKUP_SUFFIX, raw);
      }
      storage.setItem(key, serialize(next));
      state = { value: next, status: "loaded", error: null, stored: true };
    } catch (e) {
      // Quota exceeded, or storage went away. Keep the value in memory and say so.
      state = { ...state, value: next, error: `not saved: ${String(e?.message ?? e)}` };
    }
    emit();
    return state.error === null;
  }

  return {
    key,
    backupKey: key + BACKUP_SUFFIX,
    get: () => state,
    /** @param {T | ((prev: T) => T)} next */
    set(next) {
      const value = typeof next === "function" ? /** @type {Function} */ (next)(state.value) : next;
      return write(value, { allowEmpty: false });
    },
    /** The deliberate way to empty it: writes the fallback, even over a non-empty value. */
    clear() {
      return write(fallback, { allowEmpty: true });
    },
    /** Read again, e.g. after another tab changed it. Never writes. */
    reload() {
      state = read();
      emit();
    },
    /** @param {() => void} listener */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
