export type ReadStatus = "loaded" | "missing" | "unreadable" | "unavailable";

export interface PersistedOptions<T> {
  /** Defaults to localStorage. Pass sessionStorage, or null for memory only. */
  storage?: Storage | null;
  /** A stored value that fails this counts as unreadable: kept, backed up, never silently replaced. */
  validate?: (value: unknown) => boolean;
  /** Refuse `set` of an empty value ("", [], {}, null) over a stored non-empty one; `clear()` still works. */
  refuseEmpty?: boolean;
  serialize?: (value: T) => string;
  deserialize?: (raw: string) => unknown;
}

export interface PersistedState<T> {
  value: T;
  status: ReadStatus;
  /** Why the last read or write did not go as planned, in words. */
  error: string | null;
  stored: boolean;
}

export interface Persisted<T> {
  key: string;
  backupKey: string;
  get(): PersistedState<T>;
  set(next: T | ((prev: T) => T)): boolean;
  clear(): boolean;
  reload(): void;
  subscribe(listener: () => void): () => void;
}

export function createPersisted<T>(key: string, fallback: T, options?: PersistedOptions<T>): Persisted<T>;

export function usePersisted<T>(
  key: string,
  fallback: T,
  options?: PersistedOptions<T>,
): [
  value: T,
  set: (next: T | ((prev: T) => T)) => boolean,
  meta: { status: ReadStatus; error: string | null; clear: () => boolean; backupKey: string },
];

export interface DeployCheck {
  status: "current" | "stale" | "unknown";
  deployed: string | null;
  reason?: string;
}

export interface DeployCheckOptions {
  /** Defaults to "/version.json". */
  url?: string;
  /** This build's version, e.g. __APP_VERSION__ from the Vite plugin. */
  current: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export function checkDeployVersion(options: DeployCheckOptions): Promise<DeployCheck>;

export function watchDeployVersion(
  options: DeployCheckOptions & { intervalMs?: number; onResult: (result: DeployCheck) => void },
): () => void;

export function useDeployVersion(options: { current: string; url?: string; intervalMs?: number }): DeployCheck;
