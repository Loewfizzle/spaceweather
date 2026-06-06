import { ImageResponse } from 'next/og';
import { type NextRequest } from 'next/server';

export const runtime = 'edge';

export function GET(request: NextRequest) {
  const sizeParam = request.nextUrl.searchParams.get('size');
  const size = sizeParam === '512' ? 512 : 192;
  const inner = Math.round(size * 0.84);
  const radius = Math.round(size * 0.2);
  const iconSize = Math.round(size * 0.42);

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          background: '#05070f',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: inner,
            height: inner,
            borderRadius: radius,
            background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 50%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#05070f"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}
