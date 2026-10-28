/** A Storage stand-in that can be told to fail. */
export class MemoryStorage {
  constructor(entries = {}) {
    this.map = new Map(Object.entries(entries));
    this.failWrites = false;
    this.failReads = false;
    this.writes = 0;
  }
  getItem(k) {
    if (this.failReads) throw new Error("SecurityError: storage blocked");
    return this.map.has(k) ? this.map.get(k) : null;
  }
  setItem(k, v) {
    if (this.failWrites) throw new Error("QuotaExceededError");
    this.writes += 1;
    this.map.set(k, String(v));
  }
  removeItem(k) {
    this.map.delete(k);
  }
}
