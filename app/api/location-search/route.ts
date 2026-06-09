import { NextRequest, NextResponse } from "next/server";

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
