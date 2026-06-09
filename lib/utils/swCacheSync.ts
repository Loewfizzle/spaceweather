"use client";

export async function syncLiveStateToSw(
  bz: number | null,
  maxAuroraProbNA: number | null,
): Promise<boolean> {
  if (typeof window === "undefined" || !("caches" in window)) return false;
  try {
    const cache = await caches.open("skyglow-sw-v1");
    await cache.put(
      "/__state",
      new Response(
        JSON.stringify({ bz, maxProb: maxAuroraProbNA, updatedAt: Date.now() }),
      ),
    );
    return true;
  } catch {
    return false;
  }
}
