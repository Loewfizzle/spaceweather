import { NextRequest, NextResponse } from 'next/server';
import { FireballApiResponseSchema } from '@/lib/api/schemas';

// This is a server-side proxy for NASA's fireball API.
// It exists to bypass CORS restrictions that prevent direct browser fetches
// to https://ssd-api.jpl.nasa.gov in production (e.g. on space.loewfizzle.com).
// All fireball data is now fetched server-side and proxied to the client.

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let limit = parseInt(searchParams.get('limit') || '8', 10);

  // Basic input validation for the limit parameter
  if (isNaN(limit) || limit < 1 || limit > 100) {
    limit = 8;
  }

  const nasaUrl = `https://ssd-api.jpl.nasa.gov/fireball.api?limit=${limit}`;

  try {
    const res = await fetch(nasaUrl, {
      // Use Next.js fetch with revalidation for server-side caching (5 minutes)
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch from NASA fireball API: ${res.status} ${res.statusText}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    // Validate with Zod even on the server proxy for defense-in-depth
    const validated = FireballApiResponseSchema.parse(data);

    // Return the raw JSON with caching headers (suitable since data changes infrequently)
    return NextResponse.json(validated, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Fireball proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fireball data from NASA' },
      { status: 500 }
    );
  }
}

