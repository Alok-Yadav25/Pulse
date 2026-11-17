import { readStorage, saveStorage } from "./storage";

export function cacheKey(key: readonly unknown[]): string {
  return `pulse-cache:${JSON.stringify(key)}`;
}
export function cached<T>(key: readonly unknown[]): T | undefined {
  try {
    const value = JSON.parse(readStorage(cacheKey(key), "null", true));
    return value && Date.now() - value.at < 86400000
      ? (value.data as T)
      : undefined;
  } catch {
    return undefined;
  }
}
export function cache(key: readonly unknown[], data: unknown): void {
  saveStorage(cacheKey(key), JSON.stringify({ at: Date.now(), data }), true);
}
export function clearLiveCache(): void {
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith("pulse-cache:"))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch {
    /* Optional snapshots may be unavailable. */
  }
}
