import { ImageResponse } from 'next/og';
import { getKpTier, AURORA_TIERS } from '../lib/noaa';

export const alt = 'AuroraWatch — Real-time Aurora & Space Weather';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 300; // regenerate every 5 minutes

export default async function OGImage() {
  let kp: number | null = null;

  try {
    const res = await fetch(
      'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json',
      { cache: 'no-store' }
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const entry = data[data.length - 1];
        kp = typeof entry?.Kp === 'number' ? entry.Kp : null;
      }
    }
  } catch {
    // fall through to static design
  }

  const outlookLabel =
    kp === null ? null
    : kp >= 7 ? 'Excellent'
    : kp >= 5 ? 'Good'
    : kp >= 4 ? 'Moderate'
    : kp >= 3 ? 'Low'
    : 'Quiet';

  const accentColor = kp !== null ? AURORA_TIERS[getKpTier(kp)].color : '#64748b';

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: '#05070f',
          display: 'flex',
          flexDirection: 'column',
          padding: '56px 80px',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Aurora glow background */}
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            background: `radial-gradient(ellipse at 15% 55%, ${accentColor}28 0%, transparent 55%)`,
            display: 'flex',
          }}
        />

        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 52 }}>
          <div
            style={{
              width: 52, height: 52, borderRadius: 26,
              background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 50%, #8b5cf6 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width={26} height={26} viewBox="0 0 24 24" fill="#05070f">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <span style={{ color: '#f1f5f9', fontSize: 34, fontWeight: 700, letterSpacing: '-0.5px' }}>
            AuroraWatch
          </span>
          <span style={{ color: '#475569', fontSize: 20, marginLeft: 4 }}>
            NOAA SWPC · Michigan Focus
          </span>
        </div>

        {/* Main content */}
        {kp !== null && outlookLabel ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: '#64748b', fontSize: 16, letterSpacing: '3px' }}>
              PLANETARY K-INDEX — LIVE
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 28 }}>
              <div style={{ color: accentColor, fontSize: 128, fontWeight: 700, lineHeight: 1, letterSpacing: '-4px' }}>
                {kp.toFixed(1)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ color: accentColor, fontSize: 44, fontWeight: 600 }}>
                  {outlookLabel}
                </span>
                <span style={{ color: '#94a3b8', fontSize: 22 }}>
                  Tonight&#39;s Michigan Outlook
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ color: '#64748b', fontSize: 16, letterSpacing: '3px' }}>
              LIVE SPACE WEATHER DASHBOARD
            </div>
            <div style={{ color: '#f1f5f9', fontSize: 52, fontWeight: 700, letterSpacing: '-1px', display: 'flex' }}>
              Aurora &amp; Space Weather for the United States
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            position: 'absolute', bottom: 48, left: 80, right: 80,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderTop: '1px solid #1e2937', paddingTop: 22,
          }}
        >
          <span style={{ color: '#475569', fontSize: 16 }}>space.loewfizzle.com</span>
          <span style={{ color: '#475569', fontSize: 16 }}>
            OVATION · Kp Index · Solar Wind · Fireballs
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
