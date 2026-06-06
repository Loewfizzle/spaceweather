import { NextRequest, NextResponse } from "next/server";

function buildLocationString(addr: Record<string, string>): string | null {
  // Water bodies take priority
  const water =
    addr.ocean || addr.sea || addr.bay || addr.gulf || addr.strait || addr.lake || addr.reservoir;
  if (water) return water;

  // Populated place
  const city =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.hamlet ||
    addr.municipality ||
    addr.suburb;

  if (!city) return null;

  const state = addr.state;
  const code = addr.country_code?.toLowerCase();

  // US / Canada: "City, State" (country implied)
  if ((code === "us" || code === "ca") && state) return `${city}, ${state}`;
  // Everywhere else: "City, Country"
  const country = addr.country;
  if (country) return `${city}, ${country}`;
  return city;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lon = parseFloat(searchParams.get("lon") ?? "");

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ location: null }, { status: 400 });
  }

  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "AuroraWatch/1.0 (loewfizzle@gmail.com)",
        "Accept-Language": "en",
      },
      signal: AbortSignal.timeout(6_000),
      next: { revalidate: 86400 }, // coordinates are permanent — cache 24 h server-side
    });

    if (!res.ok) return NextResponse.json({ location: null });

    const data = await res.json();
    if (data?.error || !data?.address) return NextResponse.json({ location: null });

    const location = buildLocationString(data.address);
    return NextResponse.json({ location }, { headers: { "Cache-Control": "public, s-maxage=86400" } });
  } catch {
    return NextResponse.json({ location: null });
  }
}
