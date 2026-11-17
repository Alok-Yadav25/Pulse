/** Storage may be disabled or full; preferences must never crash the dashboard. */
export function readStorage(
  key: string,
  fallback = "",
  session = false,
): string {
  try {
    return (session ? sessionStorage : localStorage).getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
export function saveStorage(
  key: string,
  value: string | null,
  session = false,
): boolean {
  try {
    const storage = session ? sessionStorage : localStorage;
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
