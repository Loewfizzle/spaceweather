// Periodic Background Sync is only available in Chromium-based browsers and requires
// the "periodic-background-sync" permission. All failures are intentionally silent —
// in-tab alert polling continues to work regardless.

type PeriodicSyncReg = ServiceWorkerRegistration & {
  periodicSync: {
    register(tag: string, opts: { minInterval: number }): Promise<void>;
  };
};

/**
 * Registers the "aurora-check" Periodic Background Sync task with a 30-minute
 * minimum interval. Handles feature detection and navigator.serviceWorker.ready
 * internally; never throws — callers do not need try/catch.
 */
export async function registerPeriodicSync(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if ("periodicSync" in reg) {
      await (reg as PeriodicSyncReg).periodicSync.register("aurora-check", {
        minInterval: 30 * 60 * 1000,
      });
    }
  } catch {
    // periodicSync not supported or permission denied — in-tab alerts still work
  }
}
