"use client";

import { useState, useCallback } from "react";
import { Wind, Zap, Activity, Satellite, Info, X } from "lucide-react";
import { getKpTier, AURORA_TIERS } from "../lib/aurora/kp";
import { LoadingSkeleton } from "./LoadingSkeleton";

// ── Metric info modal ─────────────────────────────────────────────────────────

type CardId = "wind" | "bz" | "kp" | "ovation";

type ModalSection =
  | { heading: string; body: string }
  | { heading: string; rows: { kp: string; cities: string; lat: string }[] };

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
          { kp: "Kp 3–4", cities: "Fairbanks, Whitehorse",                 lat: ">60°N"    },
          { kp: "Kp 5",   cities: "Minneapolis, Seattle, Montreal",       lat: "~45–50°N" },
          { kp: "Kp 6",   cities: "Chicago, Detroit, Portland",           lat: "~42–45°N" },
          { kp: "Kp 7",   cities: "Denver, Indianapolis, New York",       lat: "~40–43°N" },
          { kp: "Kp 8–9", cities: "Dallas, Atlanta, Los Angeles",         lat: "~30–35°N" },
        ],
      },
      {
        heading: "It lags real-time conditions",
        body: "The 3-hour averaging window means Kp reflects conditions slightly in the past and updates every 3 hours. Bz and OVATION respond faster and are better short-term indicators.",
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
    ],
  },
};

function cardIcon(id: CardId) {
  if (id === "wind")    return <Wind     className="h-4 w-4 text-[#64748b]" />;
  if (id === "bz")      return <Zap      className="h-4 w-4 text-[#64748b]" />;
  if (id === "kp")      return <Activity className="h-4 w-4 text-[#64748b]" />;
  return                       <Satellite className="h-4 w-4 text-[#64748b]" />;
}

function MetricInfoModal({ card, onClose }: { card: CardId; onClose: () => void }) {
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
              <span className="uppercase tracking-[2px] text-[10px] text-[#64748b]">
                {content.title}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-[#475569] hover:text-[#94a3b8] transition-colors p-1 -mr-1"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-5 pb-5 pt-4 space-y-4">
            {content.sections.map((section) => (
              <div key={section.heading}>
                <div className="text-xs font-medium text-[#94a3b8] mb-1.5">{section.heading}</div>
                {"rows" in section ? (
                  <div className="space-y-1.5">
                    {section.rows.map(({ kp, cities, lat }) => (
                      <div key={kp} className="flex items-baseline gap-2">
                        <span className="text-[12px] font-medium text-[#cbd5e1] tabular-nums w-14 flex-shrink-0">{kp}</span>
                        <span className="text-[11px] text-[#64748b] leading-snug">{cities}</span>
                        <span className="text-[10px] text-[#475569] flex-shrink-0 ml-auto">{lat}</span>
                      </div>
                    ))}
                    <p className="text-[11px] text-[#475569] leading-relaxed pt-1">
                      Higher latitudes need lower Kp. Dark skies away from light pollution are essential at any Kp.
                    </p>
                  </div>
                ) : (
                  <p className="text-[12px] text-[#64748b] leading-relaxed">{section.body}</p>
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
              <div className="flex items-center gap-2 text-[#64748b] text-xs">
                <Wind className="w-4 h-4" /> SOLAR WIND
              </div>
              <button
                onClick={() => setOpenCard("wind")}
                className="text-[#475569] hover:text-[#64748b] transition-colors p-1 -mr-1 -mt-1"
                aria-label="About Solar Wind data"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="text-4xl font-semibold tracking-tighter tabular-nums">
              {solarWindSpeed !== null ? Math.round(solarWindSpeed) : "—"}
            </div>
            <div className="text-sm text-[#64748b] -mt-1">
              km/s{" "}
              <span className="text-xs ml-1">
                • {solarWindDensity !== null ? solarWindDensity.toFixed(1) : "—"} p/cm³
              </span>
            </div>
            <div className="mt-auto pt-2">
              {!!solarWindError && (
                <div className="text-[9px] text-amber-400 mb-0.5">data delayed</div>
              )}
              <div className="text-[10px] text-[#475569]">Updates every minute</div>
            </div>
          </div>

          {/* IMF Bz */}
          <div className="metric flex flex-col">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2 text-[#64748b] text-xs">
                <Zap className="w-4 h-4" /> IMF Bz
              </div>
              <button
                onClick={() => setOpenCard("bz")}
                className="text-[#475569] hover:text-[#64748b] transition-colors p-1 -mr-1 -mt-1"
                aria-label="About IMF Bz"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="text-4xl font-semibold tracking-tighter tabular-nums">
              {bz !== null ? bz.toFixed(1) : "—"}
            </div>
            <div className="text-sm text-[#64748b] -mt-1">
              nT <span className="text-xs ml-1">• Southward = favorable</span>
            </div>
            {bzHistory && bzHistory.length >= 3 && <BzSparkline data={bzHistory} />}
            <div className="text-[10px] text-[#475569] mt-auto pt-2">Updates every minute</div>
          </div>

          {/* Planetary Kp */}
          <div className="metric flex flex-col">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2 text-[#64748b] text-xs">
                <Activity className="w-4 h-4" /> PLANETARY Kp
              </div>
              <button
                onClick={() => setOpenCard("kp")}
                className="text-[#475569] hover:text-[#64748b] transition-colors p-1 -mr-1 -mt-1"
                aria-label="About Planetary Kp index"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="text-4xl font-semibold tracking-tighter tabular-nums">
              {kp !== null ? kp.toFixed(1) : "—"}
            </div>
            <div className="text-sm text-[#64748b] -mt-1">
              3-hour average · {kp !== null ? AURORA_TIERS[getKpTier(kp)].label : "—"}
            </div>
            <div className="text-[10px] text-[#475569] mt-auto pt-2">Updates every 3 hrs</div>
          </div>

          {/* OVATION */}
          <div className="metric flex flex-col">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2 text-[#64748b] text-xs">
                <Satellite className="w-4 h-4" /> OVATION (NA)
              </div>
              <button
                onClick={() => setOpenCard("ovation")}
                className="text-[#475569] hover:text-[#64748b] transition-colors p-1 -mr-1 -mt-1"
                aria-label="About OVATION aurora probability"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="text-4xl font-semibold tracking-tighter tabular-nums">
              {ovationProcessed && maxAuroraProbNA !== null ? `${Math.round(maxAuroraProbNA)}%` : "—"}
            </div>
            <div className="text-sm text-[#64748b] -mt-1">
              {ovationProcessed === false
                ? "Temporarily unavailable"
                : maxAuroraProbNA === 0
                ? "Quiet — aurora oval outside NA"
                : "Max probability (North America)"}
            </div>
            <div className="text-[10px] text-[#475569] mt-auto pt-2">Updates every 2 min</div>
          </div>

        </div>
      )}

      {openCard && (
        <MetricInfoModal card={openCard} onClose={closeCard} />
      )}
    </div>
  );
}
