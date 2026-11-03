// Constructors register rollback before allocating resources. No global APIs are patched.
let pending: (() => void)[] | null = null;
export function onMountRollback(cleanup: () => void): void { pending?.push(cleanup); }
export function mountSafely<T extends { destroy(): void }>(mount: () => T): T {
  const previous = pending;
  const cleanups: (() => void)[] = [];
  pending = cleanups;
  try { return mount(); }
  catch (error) {
    for (const cleanup of cleanups.reverse()) {
      try { cleanup(); } catch { /* Continue releasing the other owners. */ }
    }
    throw error;
  } finally { pending = previous; }
}
