import { NextRequest, NextResponse } from 'next/server';
import { NASAFireballRawSchema } from '@/lib/api/schemas';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let limit = parseInt(searchParams.get('limit') || '10', 10);
  if (isNaN(limit) || limit < 1 || limit > 100) {
    limit = 10;
  }

  const nasaUrl = `https://ssd-api.jpl.nasa.gov/fireball.api?limit=${limit}&sort=-date`;

  try {
    const res = await fetch(nasaUrl, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.error(`Fireball proxy error: NASA JPL returned ${res.status} ${res.statusText}`);
      return NextResponse.json(
        { error: `Failed to fetch from NASA JPL fireball API: ${res.status} ${res.statusText}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const validated = NASAFireballRawSchema.parse(data);

    return NextResponse.json(validated, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Fireball proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fireball data from NASA JPL' },
      { status: 500 }
    );
  }
}
