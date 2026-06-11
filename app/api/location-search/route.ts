import { NextRequest, NextResponse } from "next/server";

// Simple per-instance sliding-window rate limiter (10 req/min per IP).
// Per-instance only — resets on cold start, but sufficient for launch-scale abuse prevention.
const RL_WINDOW_MS = 60_000;
const RL_MAX_HITS = 10;
const _rl = new Map<string, number[]>();
function isRateLimited(ip: string | null): boolean {
  // No x-forwarded-for means local dev or tests; Vercel always sets it in production.
  if (!ip) return false;
  const now = Date.now();
  if (_rl.size > 1000) {
    for (const [key, times] of _rl) {
      if (now - times[times.length - 1] >= RL_WINDOW_MS) _rl.delete(key);
    }
  }
  const hits = (_rl.get(ip) ?? []).filter((t) => now - t < RL_WINDOW_MS);
  if (hits.length >= RL_MAX_HITS) return true;
  hits.push(now);
  _rl.set(ip, hits);
  return false;
}

export interface LocationSearchResult {
  lat: number;
  lon: number;
  label: string;
}

function buildLabel(addr: Record<string, string>, displayName: string): string {
  const city =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.hamlet ||
    addr.municipality ||
    addr.suburb ||
    addr.county;

  const state = addr.state;
  const code = addr.country_code?.toLowerCase();

  if (city) {
    if ((code === "us" || code === "ca") && state) return `${city}, ${state}`;
    if (addr.country) return `${city}, ${addr.country}`;
    return city;
  }

  // Postal-code query — no city field populated
  if (addr.postcode) {
    const parts = [addr.postcode, state, addr.country].filter(Boolean);
    return parts.join(", ");
  }

  // Fallback: first two comma-separated segments of display_name
  return displayName.split(",").slice(0, 2).join(",").trim() || displayName;
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  if (isRateLimited(ip)) {
    return NextResponse.json({ results: [] }, { status: 429 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "SkyGlow/1.0 (loewfizzle@gmail.com)",
        "Accept-Language": "en",
      },
      signal: AbortSignal.timeout(6_000),
    });

    if (!res.ok) return NextResponse.json({ results: [] });

    const data: Array<{
      lat: string;
      lon: string;
      display_name: string;
      address: Record<string, string>;
    }> = await res.json();

    const results: LocationSearchResult[] = (data ?? [])
      .slice(0, 5)
      .map((item) => ({
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        label: buildLabel(item.address ?? {}, item.display_name ?? ""),
      }))
      .filter((r): r is LocationSearchResult => isFinite(r.lat) && isFinite(r.lon));

    return NextResponse.json(
      { results },
      { headers: { "Cache-Control": "public, s-maxage=3600" } }
    );
  } catch {
    return NextResponse.json({ results: [] });
  }
}
