/** Shared defaults for a brand-new, not-yet-saved-to-the-backend editing session. */

const LOCAL_PROJECT_ID_STORAGE_KEY = "apc_local_project_id";

/** e.g. "APC on Sep 14, 2026 at 02:45 AM" — the seeded default title for a fresh project,
 *  before the user (or Review) gives it a real one. */
export const defaultProjectTitle = (): string => {
  const now = new Date();
  const date = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  return `APC on ${date} at ${time}`;
};

/**
 * A stable id for the current browser's *local-only* editing draft — not a
 * backend `Clip` id, since nothing is saved to the backend until Review's
 * "Done". Persisted in `localStorage` (not `sessionStorage`) so the exact
 * point of this — surviving a crash or accidental tab close before that
 * happens — actually holds; reused across reloads so autosave keeps writing
 * to the same IndexedDB draft instead of orphaning a new one every time.
 */
export const getOrCreateLocalProjectId = (): string => {
  if (typeof window === "undefined") return crypto.randomUUID();
  const existing = window.localStorage.getItem(LOCAL_PROJECT_ID_STORAGE_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(LOCAL_PROJECT_ID_STORAGE_KEY, created);
  return created;
};

/** Clears the local draft id so the next recording starts a fresh one —
 *  called once a project is actually saved to the backend (Review's "Done")
 *  or explicitly discarded, so a finished project's slot isn't reused. */
export const clearLocalProjectId = (): void => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LOCAL_PROJECT_ID_STORAGE_KEY);
};
