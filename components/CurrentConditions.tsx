"use client";

import { useState, useCallback } from "react";
import { Wind, Zap, Activity, Satellite, Info, X } from "lucide-react";
import { useBodyScrollLock } from "../lib/hooks/useBodyScrollLock";
import { getKpTier, AURORA_TIERS, solarWindSpeedColor, bzColor } from "../lib/aurora/kp";
import { getAuroraColor } from "../lib/aurora/ovation";
import { LoadingSkeleton } from "./LoadingSkeleton";

// ── Metric info modal ─────────────────────────────────────────────────────────

type CardId = "wind" | "bz" | "kp" | "ovation";

type LegendRow = { color: string; range: string; desc: string };
type ModalSection =
  | { heading: string; body: string }
  | { heading: string; rows: { kp: string; cities: string; lat: string }[] }
  | { heading: string; legend: LegendRow[]; note?: string };

const MODAL_CONTENT: Record<CardId, { title: string; sections: ModalSection[] }> = {
  wind: {
    title: "Solar Wind",
    sections: [
      {
        heading: "What it is",
        body: "A constant stream of charged particles — mostly protons and electrons — flowing outward from the Sun at hundreds of kilometers per second.",
      },
      {
        heading: "Speed",
        body: "Above 500 km/s starts to be interesting. Above 600 km/s is elevated and can enhance geomagnetic activity even without high Kp.",
      },
      {
        heading: "Density",
        body: "Higher density means more particles hitting Earth's magnetosphere. It amplifies the effect of speed — a slow but dense wind can still be significant.",
      },
      {
        heading: "Aurora relevance",
        body: "Fast, dense solar wind compresses Earth's magnetosphere and increases the chance of activity, especially when combined with southward Bz.",
      },
      {
        heading: "What the color means",
        legend: [
          { color: '#64748b', range: "below 400 km/s", desc: "quiet background wind, minimal aurora impact" },
          { color: '#22c55e', range: "400–500 km/s",   desc: "nominal speed, aurora possible with favorable Bz" },
          { color: '#eab308', range: "500–600 km/s",   desc: "elevated, enhancing aurora chances if Bz cooperates" },
          { color: '#f97316', range: "600–700 km/s",   desc: "fast wind delivering significant energy to the magnetosphere" },
          { color: '#a78bfa', range: "above 700 km/s", desc: "very fast, storm-level solar wind" },
        ],
      },
    ],
  },
  bz: {
    title: "IMF Bz",
    sections: [
      {
        heading: "What it is",
        body: "The north-south orientation of the interplanetary magnetic field (IMF) carried by the solar wind, measured in nanoteslas (nT).",
      },
      {
        heading: "Southward is favorable",
        body: "Negative Bz allows solar wind energy to couple with Earth's magnetic field and drive aurora. 0 to −5 nT is mildly favorable, −5 to −10 nT is good, below −10 nT is excellent.",
      },
      {
        heading: "Northward blocks activity",
        body: "Positive Bz blocks coupling almost entirely. Even high Kp can produce weak aurora when Bz is northward — it acts like a closed door.",
      },
      {
        heading: "Can flip rapidly",
        body: "Bz can reverse direction in minutes, which is why conditions can change so quickly. Real-time monitoring matters more here than any other single metric.",
      },
      {
        heading: "What the color means",
        legend: [
          { color: '#64748b', range: "above −2 nT",    desc: "neutral or northward, aurora largely blocked" },
          { color: '#22c55e', range: "−2 to −5 nT",    desc: "mildly southward, slightly favorable" },
          { color: '#eab308', range: "−5 to −10 nT",   desc: "southward, genuinely favorable for aurora" },
          { color: '#f97316', range: "−10 to −15 nT",  desc: "strongly southward, excellent conditions" },
          { color: '#a78bfa', range: "below −15 nT",   desc: "exceptional, storm-level coupling" },
        ],
        note: "Gray covers both neutral and positive Bz — northward Bz is simply blocking, with no escalating danger, just absence of aurora opportunity.",
      },
    ],
  },
  kp: {
    title: "Planetary Kp Index",
    sections: [
      {
        heading: "What it is",
        body: "A 0–9 index measuring global geomagnetic disturbance, averaged from ground magnetometer stations worldwide over 3-hour windows.",
      },
      {
        heading: "Visibility by latitude",
        rows: [
          { kp: "Kp 3–4", cities: "Fairbanks, Whitehorse",         lat: ">60°N"    },
          { kp: "Kp 5",   cities: "Minneapolis, Seattle, Montreal", lat: "~45–50°N" },
          { kp: "Kp 6",   cities: "Chicago, Detroit, Portland",     lat: "~42–45°N" },
          { kp: "Kp 7",   cities: "Denver, Indianapolis, New York", lat: "~40–43°N" },
          { kp: "Kp 8–9", cities: "Dallas, Atlanta, Los Angeles",   lat: "~30–35°N" },
        ],
      },
      {
        heading: "It lags real-time conditions",
        body: "The 3-hour averaging window means Kp reflects conditions slightly in the past and updates every 3 hours. Bz and OVATION respond faster and are better short-term indicators.",
      },
      {
        heading: "What the color means",
        legend: [
          { color: '#64748b', range: "Kp 0–3 (Quiet)",    desc: "no aurora visible in the continental US" },
          { color: '#22c55e', range: "Kp 4 (Moderate)",   desc: "aurora possible from the far northern tier" },
          { color: '#eab308', range: "Kp 5 (Active)",     desc: "aurora reaching the northern US border region" },
          { color: '#f97316', range: "Kp 6 (Strong)",     desc: "aurora at mid-latitudes, visible from upper Midwest" },
          { color: '#a78bfa', range: "Kp 7–9 (Storm)",    desc: "widespread aurora across much of North America" },
        ],
      },
    ],
  },
  ovation: {
    title: "OVATION Aurora Model",
    sections: [
      {
        heading: "What it is",
        body: "A NOAA model that predicts auroral probability globally based on real-time solar wind data from the DSCOVR satellite at the L1 Lagrange point.",
      },
      {
        heading: "What the number means",
        body: "The percentage shown is the maximum probability anywhere in North America — not specifically at your location. The aurora map shows the full spatial distribution.",
      },
      {
        heading: "More responsive than Kp",
        body: "OVATION updates more frequently than Kp and can show elevated chances before Kp catches up. Low OVATION with high Kp — or the reverse — is common. Use both together for the best picture.",
      },
      {
        heading: "What the color means",
        legend: [
          { color: '#64748b', range: "below 15%", desc: "quiet, oval not reaching this area" },
          { color: '#22c55e', range: "15–30%",    desc: "low but real signal, aurora present at high latitudes" },
          { color: '#eab308', range: "30–45%",    desc: "moderate, aurora pushing southward" },
          { color: '#f97316', range: "45–60%",    desc: "strong activity over the region" },
          { color: '#a78bfa', range: "60%+",      desc: "major aurora event, high intensity overhead" },
        ],
      },
    ],
  },
};

function cardIcon(id: CardId) {
  if (id === "wind")    return <Wind     className="h-4 w-4 text-[#94a3b8]" />;
  if (id === "bz")      return <Zap      className="h-4 w-4 text-[#94a3b8]" />;
  if (id === "kp")      return <Activity className="h-4 w-4 text-[#94a3b8]" />;
  return                       <Satellite className="h-4 w-4 text-[#94a3b8]" />;
}

function MetricInfoModal({ card, onClose }: { card: CardId; onClose: () => void }) {
  useBodyScrollLock();
  const content = MODAL_CONTENT[card];

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={content.title}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="bg-[#0d1425] border border-[#1e2937] rounded-2xl w-full max-w-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-0">
            <div className="flex items-center gap-2">
              {cardIcon(card)}
              <span className="uppercase tracking-[2px] text-[10px] text-[#94a3b8]">
                {content.title}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-[#64748b] hover:text-[#94a3b8] transition-colors p-1 -mr-1"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-5 pb-5 pt-4 space-y-4">
            {content.sections.map((section) => (
              <div key={section.heading}>
                <div className="text-xs font-medium text-[#94a3b8] mb-1.5">{section.heading}</div>
                {"legend" in section ? (
                  <div className="space-y-1.5">
                    {section.legend.map(({ color, range, desc }) => (
                      <div key={range} className="flex items-start gap-2.5">
                        <span className="mt-[3px] h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-xs text-[#94a3b8] leading-snug">
                          <span className="font-medium text-[#cbd5e1]">{range}</span>
                          {" — "}{desc}
                        </span>
                      </div>
                    ))}
                    {section.note && (
                      <p className="text-xs text-[#64748b] leading-relaxed pt-1">{section.note}</p>
                    )}
                  </div>
                ) : "rows" in section ? (
                  <div className="space-y-1.5">
                    {section.rows.map(({ kp, cities, lat }) => (
                      <div key={kp} className="flex items-center gap-2">
                        <span className="text-[12px] font-medium text-[#cbd5e1] tabular-nums w-14 flex-shrink-0">{kp}</span>
                        <span className="text-xs text-[#94a3b8] leading-snug">{cities}</span>
                        <span className="text-[10px] text-[#64748b] flex-shrink-0 ml-auto">{lat}</span>
                      </div>
                    ))}
                    <p className="text-xs text-[#64748b] leading-relaxed pt-1">
                      Higher latitudes need lower Kp. Dark skies away from light pollution are essential at any Kp.
                    </p>
                  </div>
                ) : (
                  <p className="text-[12px] text-[#94a3b8] leading-relaxed">{section.body}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface CurrentConditionsProps {
  solarWindSpeed: number | null;
  solarWindDensity: number | null;
  bz: number | null;
  bzHistory?: number[];
  kp: number | null;
  maxAuroraProbNA: number | null;
  isLoading: boolean;
  solarWindError?: unknown;
  ovationProcessed?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

function BzSparkline({ data }: { data: number[] }) {
  if (data.length < 3) return null;
  const W = 100;
  const H = 28;
  const pad = 1.5;
  const min = Math.min(...data, -2);
  const max = Math.max(...data, 2);
  const range = max - min || 1;
  const toX = (i: number) => pad + (i / (data.length - 1)) * (W - pad * 2);
  const toY = (v: number) => H - pad - ((v - min) / range) * (H - pad * 2);
  const zeroY = toY(0);
  const points = data.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const latest = data[data.length - 1];
  const lineColor = latest <= -5 ? '#22c55e' : latest <= -2 ? '#94a3b8' : '#475569';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-2" style={{ height: 28 }} aria-hidden="true">
      <line x1={pad} y1={zeroY} x2={W - pad} y2={zeroY} stroke="#1e2937" strokeWidth="1" />
      <polyline points={points} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
    </svg>
  );
}

export function CurrentConditions({
  solarWindSpeed,
  solarWindDensity,
  bz,
  bzHistory,
  kp,
  maxAuroraProbNA,
  isLoading,
  solarWindError,
  ovationProcessed,
}: CurrentConditionsProps) {
  const [openCard, setOpenCard] = useState<CardId | null>(null);
  const closeCard = useCallback(() => setOpenCard(null), []);

  // Dot: null = hidden during initial load, red = feed down, yellow = partial/stale, green = fresh
  const dotColor = (() => {
    if (isLoading && kp === null) return null;
    if (solarWindError && kp === null) return '#ef4444';
    if (solarWindError) return '#eab308';
    if (kp === null) return '#eab308';
    return '#22c55e';
  })();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
      <div className="section-title flex items-center gap-2">
        {dotColor && (
          <span
            className="animate-pulse block rounded-full flex-shrink-0"
            style={{ width: '7px', height: '7px', backgroundColor: dotColor }}
            title={dotColor === '#22c55e' ? 'Data feed live' : dotColor === '#eab308' ? 'Data delayed' : 'Feed error'}
          />
        )}
        LIVE CONDITIONS
      </div>
      {isLoading ? (
        <LoadingSkeleton variant="metrics" count={4} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

          {/* Solar Wind */}
          <div className="metric flex flex-col">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2 text-[#94a3b8] text-xs">
                <Wind className="w-4 h-4" style={solarWindSpeed !== null ? { color: solarWindSpeedColor(solarWindSpeed) } : undefined} /> SOLAR WIND
              </div>
              <button
                onClick={() => setOpenCard("wind")}
                className="text-[#64748b] hover:text-[#94a3b8] transition-colors p-1 -mr-1 -mt-1"
                aria-label="About Solar Wind data"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="text-4xl font-semibold tracking-tighter tabular-nums" style={solarWindSpeed !== null ? { color: solarWindSpeedColor(solarWindSpeed) } : undefined}>
              {solarWindSpeed !== null ? Math.round(solarWindSpeed) : "—"}
            </div>
            <div className="text-sm text-[#94a3b8] -mt-1">
              km/s{" "}
              <span className="text-xs ml-1">
                • {solarWindDensity !== null ? solarWindDensity.toFixed(1) : "—"} p/cm³
              </span>
            </div>
            <div className="mt-auto pt-2">
              {!!solarWindError && (
                <div className="text-[9px] text-amber-400 mb-0.5">data delayed</div>
              )}
              <div className="text-[10px] text-[#64748b]">Updates every minute</div>
            </div>
          </div>

          {/* IMF Bz */}
          <div className="metric flex flex-col">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2 text-[#94a3b8] text-xs">
                <Zap className="w-4 h-4" style={bz !== null ? { color: bzColor(bz) } : undefined} /> IMF Bz
              </div>
              <button
                onClick={() => setOpenCard("bz")}
                className="text-[#64748b] hover:text-[#94a3b8] transition-colors p-1 -mr-1 -mt-1"
                aria-label="About IMF Bz"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="text-4xl font-semibold tracking-tighter tabular-nums" style={bz !== null ? { color: bzColor(bz) } : undefined}>
              {bz !== null ? bz.toFixed(1) : "—"}
            </div>
            <div className="text-sm text-[#94a3b8] -mt-1">
              nT <span className="text-xs ml-1">• Southward = favorable</span>
            </div>
            {bzHistory && bzHistory.length >= 3 && <BzSparkline data={bzHistory} />}
            <div className="text-[10px] text-[#64748b] mt-auto pt-2">Updates every minute</div>
          </div>

          {/* Planetary Kp */}
          <div className="metric flex flex-col">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2 text-[#94a3b8] text-xs">
                <Activity className="w-4 h-4" style={kp !== null ? { color: AURORA_TIERS[getKpTier(kp)].color } : undefined} /> PLANETARY Kp
              </div>
              <button
                onClick={() => setOpenCard("kp")}
                className="text-[#64748b] hover:text-[#94a3b8] transition-colors p-1 -mr-1 -mt-1"
                aria-label="About Planetary Kp index"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="text-4xl font-semibold tracking-tighter tabular-nums" style={kp !== null ? { color: AURORA_TIERS[getKpTier(kp)].color } : undefined}>
              {kp !== null ? kp.toFixed(1) : "—"}
            </div>
            <div className="text-sm text-[#94a3b8] -mt-1">
              3-hour average · {kp !== null ? AURORA_TIERS[getKpTier(kp)].label : "—"}
            </div>
            <div className="text-[10px] text-[#64748b] mt-auto pt-2">Updates every 3 hrs</div>
          </div>

          {/* OVATION */}
          <div className="metric flex flex-col">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2 text-[#94a3b8] text-xs">
                <Satellite className="w-4 h-4" style={ovationProcessed && maxAuroraProbNA !== null ? { color: getAuroraColor(maxAuroraProbNA) } : undefined} /> OVATION (NA)
              </div>
              <button
                onClick={() => setOpenCard("ovation")}
                className="text-[#64748b] hover:text-[#94a3b8] transition-colors p-1 -mr-1 -mt-1"
                aria-label="About OVATION aurora probability"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="text-4xl font-semibold tracking-tighter tabular-nums" style={ovationProcessed && maxAuroraProbNA !== null ? { color: getAuroraColor(maxAuroraProbNA) } : undefined}>
              {ovationProcessed && maxAuroraProbNA !== null ? `${Math.round(maxAuroraProbNA)}%` : "—"}
            </div>
            <div className="text-sm text-[#94a3b8] -mt-1">
              {ovationProcessed === false
                ? "Temporarily unavailable"
                : maxAuroraProbNA === 0
                ? "Quiet — aurora oval outside NA"
                : "Max probability (North America)"}
            </div>
            <div className="text-[10px] text-[#64748b] mt-auto pt-2">Updates every 2 min</div>
          </div>

        </div>
      )}

      {openCard && (
        <MetricInfoModal card={openCard} onClose={closeCard} />
      )}
    </div>
  );
}
