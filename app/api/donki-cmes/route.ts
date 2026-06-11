import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logDataError } from '@/lib/utils/retry';

const fmt = (d: Date) => d.toISOString().split('T')[0];

export async function GET() {
  const today = new Date();
  const startDate = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    startDate: fmt(startDate),
    endDate: fmt(today),
    mostAccurateOnly: 'true',
    speed: '0',
    halfAngle: '0',
  });

  const donkiUrl = `https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/CMEAnalysis?${params}`;

  try {
    const res = await fetch(donkiUrl, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const err = new Error(`DONKI returned ${res.status} ${res.statusText}`);
      logDataError('DONKI proxy: upstream', err, { status: res.status }, false, 'alerts');
      return NextResponse.json(
        { error: `DONKI upstream error: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const validated = z.array(z.record(z.string(), z.unknown())).parse(data);

    return NextResponse.json(validated, {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    logDataError('DONKI proxy: error', error, undefined, false, 'alerts');
    return NextResponse.json({ error: 'Failed to fetch DONKI CME data' }, { status: 500 });
  }
}
