import { ImageResponse } from 'next/og';
import { getTonightOutlook } from '@/lib/aurora/outlook';

export const alt = "SkyGlow — Tonight's Aurora Outlook";
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 300; // regenerate every 5 minutes

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchKp(): Promise<number | null> {
  try {
    const res = await fetch(
      'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json',
      { cache: 'no-store', signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length < 2) return null;
    const entry = data[data.length - 1];
    return typeof entry?.Kp === 'number' ? entry.Kp : null;
  } catch {
    return null;
  }
}

async function fetchBz(): Promise<number | null> {
  try {
    const res = await fetch(
      'https://services.swpc.noaa.gov/products/solar-wind/mag-6-hour.json',
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const raw: string[][] = await res.json();
    if (!Array.isArray(raw) || raw.length < 2) return null;
    const headers = raw[0];
    const last = raw[raw.length - 1];
    const bzIdx = headers.indexOf('bz_gsm');
    if (bzIdx === -1) return null;
    const val = parseFloat(last[bzIdx]);
    return isNaN(val) ? null : val;
  } catch {
    return null;
  }
}

// ── Derived values ─────────────────────────────────────────────────────────────

// Maps kp to visibility-likelihood color matching the app's AURORA_TIERS scale.
function colorFromKp(kp: number): string {
  if (kp >= 7) return '#a78bfa'; // storm
  if (kp >= 6) return '#f97316'; // strong
  if (kp >= 5) return '#eab308'; // active
  if (kp >= 4) return '#22c55e'; // moderate
  return '#64748b';               // quiet
}

// ── Component ─────────────────────────────────────────────────────────────────

export default async function OGImage() {
  const [kp, bz] = await Promise.all([fetchKp(), fetchBz()]);

  const outlook = kp !== null ? getTonightOutlook(kp, bz, null) : null;
  const label = outlook?.status ?? 'No Data';
  const accent = kp !== null ? colorFromKp(kp) : '#64748b';
  const message = outlook?.message ?? 'Real-time aurora visibility for the northern United States.';

  // Aurora curtain bands: bottom (bright + thick) → top (faint + thin)
  const bands: Array<{ y: number; amp: number; sw: number; op: number }> = [
    { y: 292, amp: 38, sw: 5.5, op: 0.80 },
    { y: 258, amp: 32, sw: 4.5, op: 0.65 },
    { y: 226, amp: 26, sw: 3.5, op: 0.50 },
    { y: 196, amp: 22, sw: 3.0, op: 0.36 },
    { y: 168, amp: 17, sw: 2.5, op: 0.24 },
    { y: 143, amp: 13, sw: 2.0, op: 0.15 },
    { y: 121, amp: 9,  sw: 1.5, op: 0.08 },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200, height: 630,
          background: '#05070f',
          display: 'flex', flexDirection: 'column',
          padding: '52px 80px 44px 80px',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background glows */}
        <div
          style={{
            position: 'absolute', top: -160, left: -120,
            width: 720, height: 720, borderRadius: '50%',
            background: `radial-gradient(circle at center, ${accent}1c 0%, transparent 62%)`,
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute', bottom: -100, right: 80,
            width: 480, height: 480, borderRadius: '50%',
            background: `radial-gradient(circle at center, ${accent}12 0%, transparent 60%)`,
            display: 'flex',
          }}
        />

        {/* ── Header ── */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 36,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 48, height: 48, borderRadius: 24, flexShrink: 0,
                background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 50%, #8b5cf6 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width={22} height={22} viewBox="0 0 24 24" fill="#05070f">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <span style={{ color: '#f1f5f9', fontSize: 30, fontWeight: 700, letterSpacing: '-0.5px' }}>
              SkyGlow
            </span>
            <span style={{ color: '#334155', fontSize: 18, marginLeft: 8 }}>
              Northern US &amp; Canada
            </span>
          </div>

          {/* Live badge */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#0c1220', borderRadius: 22,
              padding: '9px 20px',
              border: '1px solid #1e2937',
            }}
          >
            <div
              style={{
                width: 7, height: 7, borderRadius: 4,
                background: '#22c55e', flexShrink: 0,
              }}
            />
            <span style={{ color: '#64748b', fontSize: 13, letterSpacing: '2.5px' }}>LIVE</span>
          </div>
        </div>

        {/* ── Main content row ── */}
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 0 }}>

          {/* Left: data */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 0 }}>
            {/* Eyebrow */}
            <div style={{ color: '#475569', fontSize: 13, letterSpacing: '3.5px', marginBottom: 14 }}>
              TONIGHT&apos;S OUTLOOK
            </div>

            {/* Status label */}
            <div
              style={{
                color: accent,
                fontSize: label.length >= 8 ? 72 : 88,
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: '-2px',
                marginBottom: 22,
              }}
            >
              {label}
            </div>

            {/* Metrics pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              {kp !== null && (
                <div
                  style={{
                    display: 'flex', alignItems: 'baseline', gap: 5,
                    background: `${accent}16`,
                    borderRadius: 10, padding: '7px 16px',
                    border: `1px solid ${accent}35`,
                  }}
                >
                  <span style={{ color: '#475569', fontSize: 13, letterSpacing: '1px' }}>Kp</span>
                  <span style={{ color: accent, fontSize: 26, fontWeight: 700 }}>
                    {kp.toFixed(1)}
                  </span>
                </div>
              )}
              {bz !== null && (
                <div
                  style={{
                    display: 'flex', alignItems: 'baseline', gap: 5,
                    background: bz <= -5 ? '#22c55e14' : '#0c1220',
                    borderRadius: 10, padding: '7px 16px',
                    border: `1px solid ${bz <= -5 ? '#22c55e30' : '#1e2937'}`,
                  }}
                >
                  <span style={{ color: '#475569', fontSize: 13, letterSpacing: '1px' }}>Bz</span>
                  <span
                    style={{
                      color: bz <= -5 ? '#22c55e' : '#64748b',
                      fontSize: 26, fontWeight: 700,
                    }}
                  >
                    {bz > 0 ? '+' : ''}{bz.toFixed(1)}
                  </span>
                  <span style={{ color: '#334155', fontSize: 13 }}>nT</span>
                </div>
              )}
            </div>

            {/* Message */}
            <div style={{ color: '#64748b', fontSize: 19, lineHeight: 1.55, maxWidth: 510 }}>
              {message}
            </div>
          </div>

          {/* Right: aurora curtain visual */}
          <div
            style={{
              width: 420, height: 340, flexShrink: 0,
              position: 'relative', display: 'flex',
            }}
          >
            {/* Curtain glow */}
            <div
              style={{
                position: 'absolute', top: 40, left: 10, right: 10,
                height: 240, borderRadius: '50%',
                background: `radial-gradient(ellipse at center, ${accent}1a 0%, transparent 68%)`,
                display: 'flex',
              }}
            />
            {/* Curtain lines */}
            <svg
              width="420" height="340" viewBox="0 0 420 340"
              style={{ position: 'absolute', top: 0, left: 0 }}
            >
              {bands.map((b, i) => (
                <path
                  key={i}
                  d={`M-10,${b.y} C80,${b.y - b.amp} 160,${b.y + b.amp} 270,${b.y} S380,${b.y - b.amp * 0.6} 440,${b.y + b.amp * 0.3}`}
                  stroke={accent}
                  strokeWidth={b.sw}
                  fill="none"
                  opacity={b.op}
                  strokeLinecap="round"
                />
              ))}
              {/* Faint duplicate for glow depth */}
              {bands.slice(0, 4).map((b, i) => (
                <path
                  key={`g${i}`}
                  d={`M-10,${b.y} C80,${b.y - b.amp} 160,${b.y + b.amp} 270,${b.y} S380,${b.y - b.amp * 0.6} 440,${b.y + b.amp * 0.3}`}
                  stroke={accent}
                  strokeWidth={b.sw * 3.5}
                  fill="none"
                  opacity={0.04}
                  strokeLinecap="round"
                />
              ))}
            </svg>
          </div>
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderTop: '1px solid #0f1828',
            paddingTop: 20, marginTop: 24,
          }}
        >
          <span style={{ color: '#1e3248', fontSize: 15 }}>skyglow.app</span>
          <span style={{ color: '#1e3248', fontSize: 15 }}>
            OVATION · Kp Index · Solar Wind · NOAA SWPC
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
