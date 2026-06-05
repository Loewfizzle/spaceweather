import { NextRequest, NextResponse } from 'next/server';
import { AMSFireballApiResponseSchema } from '@/lib/api/schemas';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let limit = parseInt(searchParams.get('limit') || '8', 10);
  if (isNaN(limit) || limit < 1 || limit > 100) {
    limit = 8;
  }

  const apiKey = process.env.AMS_API_KEY;
  if (!apiKey) {
    console.error('Fireball proxy error: AMS_API_KEY is not set');
    return NextResponse.json({ error: 'AMS API key not configured' }, { status: 500 });
  }

  const amsUrl = `https://fireball.amsmeteors.org/members/api/v1/fireball_report?api_key=${apiKey}&days=7&country=US&sortby=witnesses&order=desc&limit=${limit}`;

  try {
    const res = await fetch(amsUrl, {
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      console.error(`Fireball proxy error: AMS returned ${res.status} ${res.statusText}`);
      return NextResponse.json(
        { error: `Failed to fetch from AMS fireball API: ${res.status} ${res.statusText}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const validated = AMSFireballApiResponseSchema.parse(data);

    return NextResponse.json(validated, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Fireball proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fireball data from AMS' },
      { status: 500 }
    );
  }
}
