import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const lat = parseFloat(request.nextUrl.searchParams.get('lat') ?? '');
  const lon = parseFloat(request.nextUrl.searchParams.get('lon') ?? '');

  if (!isFinite(lat) || !isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
  }

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&current=cloud_cover` +
    `&hourly=cloud_cover` +
    `&forecast_days=2` +
    `&timezone=auto`;

  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!upstream.ok) {
      return NextResponse.json({ error: 'Upstream error' }, { status: 502 });
    }
    const data = await upstream.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch cloud cover' }, { status: 500 });
  }
}
