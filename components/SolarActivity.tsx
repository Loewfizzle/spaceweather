"use client";

import { useState, useCallback } from "react";
import { Sun, TrendingUp, Zap, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useSolarActivity } from "../lib/use-noaa-data";
import { FlareModal, flareClassInfo } from "./solar/FlareModal";
import { CmeModal, cmeImpactColor } from "./solar/CmeModal";
import { SunspotModal, sunspotContext } from "./solar/SunspotModal";
import { CoronalModal } from "./solar/CoronalModal";
import { SdoImage, SDO_DATA_URL } from "./solar/SdoImage";

const SDO_SUNSPOT_URL = "https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_HMIIC.jpg";
const SDO_CORONAL_URL = "https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_0193.jpg";

function formatCmeIssued(isoTime: string): string {
  const t = new Date(isoTime).getTime();
  if (!isFinite(t) || t > Date.now()) return 'just now';
  return formatDistanceToNow(new Date(t), { addSuffix: true });
}

export function SolarActivity() {
  const solarActivity = useSolarActivity();
  const [openModal, setOpenModal] = useState<"flare" | "cme" | "sunspot" | "coronal" | null>(null);
  const closeModal = useCallback(() => setOpenModal(null), []);
  const sunCtx = solarActivity.sunspotNumber !== null ? sunspotContext(solarActivity.sunspotNumber) : null;

  const latestFlare = solarActivity.latestFlare;
  const flareClass = latestFlare?.max_class || latestFlare?.current_class;
  const flareInfo = flareClassInfo(flareClass);
  const flareTime = latestFlare?.max_time || solarActivity.flareTime;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
      <div className="section-title">SOLAR ACTIVITY</div>

      {/* Metric cards: Latest Flare + Recent CMEs */}
      {solarActivity.isLoading ? (
        <div className="grid grid-cols-2 gap-3 mb-3">
          {[0, 1].map((i) => (
            <div key={i} className="metric">
              <div className="h-3 w-16 rounded animate-pulse bg-[#1e2937] mb-3" />
              <div className="h-8 w-14 rounded animate-pulse bg-[#1e2937] mb-2" />
              <div className="h-3 w-24 rounded animate-pulse bg-[#1e2937]" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Latest Flare — clickable when data is available */}
          <div
            className={`metric transition-colors ${latestFlare ? 'hover:border-[#293548] cursor-pointer' : 'cursor-default'}`}
            onClick={() => latestFlare && setOpenModal("flare")}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2 text-[#64748b] text-xs">
                <Zap
                  className="w-4 h-4"
                  style={flareClass ? { color: flareInfo.color } : undefined}
                />
                LATEST FLARE
              </div>
              {latestFlare && (
                <button
                  onClick={(e) => { e.stopPropagation(); setOpenModal("flare"); }}
                  className="text-xs text-[#64748b] hover:text-[#94a3b8] transition-colors flex items-center gap-0.5"
                >
                  Details <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div
              className="text-4xl font-semibold tracking-tighter tabular-nums leading-none"
              style={flareClass ? { color: flareInfo.color } : undefined}
            >
              {flareClass ?? "—"}
            </div>

            {flareClass && (
              <div className="text-xs mt-1.5" style={{ color: flareInfo.color }}>
                {flareInfo.tier} flare
              </div>
            )}

            <div className="text-xs text-[#64748b] mt-0.5">
              {flareTime
                ? formatDistanceToNow(new Date(flareTime), { addSuffix: true })
                : "—"}
              {latestFlare?.region != null && ` · Region ${latestFlare.region}`}
            </div>

            {!latestFlare && !solarActivity.error && (
              <div className="text-[10px] text-[#475569] mt-1">
                No flares detected recently.
              </div>
            )}
          </div>

          {/* Recent CMEs */}
          <div className="metric">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2 text-[#64748b] text-xs">
                <TrendingUp className="w-4 h-4" /> RECENT CMEs
              </div>
              <button
                onClick={() => setOpenModal("cme")}
                className="text-xs text-[#64748b] hover:text-[#94a3b8] transition-colors flex items-center gap-0.5"
              >
                Details <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {solarActivity.recentCmes.length > 0 ? (
              solarActivity.recentCmes.slice(0, 1).map((cme) => {
                const color = cmeImpactColor(cme.earthImpact);
                return (
                  <div key={0}>
                    <div
                      className="text-4xl font-semibold tracking-tighter tabular-nums leading-none"
                      style={{ color }}
                    >
                      {cme.speed ? `${cme.speed.toLocaleString()} km/s` : "CME Alert"}
                    </div>

                    {cme.earthImpact && (
                      <div className="text-xs mt-1.5" style={{ color }}>
                        {cme.earthImpact}
                      </div>
                    )}

                    {cme.associatedFlare && (
                      <div className="text-[11px] text-[#64748b] mt-1">
                        Associated with {cme.associatedFlare} flare
                      </div>
                    )}

                    <div className="text-[10px] text-[#475569] mt-0.5">
                      Alert issued {formatCmeIssued(cme.time)}
                      {solarActivity.recentCmes.length > 1 && ` · ${solarActivity.recentCmes.length} total`}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-[#64748b]">—</div>
            )}

            <div className="text-[10px] text-[#475569] mt-3 pt-2.5 border-t border-[#0f1425]">
              {solarActivity.recentCmes.some((c) => {
                const lc = (c.earthImpact ?? "").toLowerCase();
                return lc.includes("likely");
              })
                ? "Earth-directed CMEs typically arrive in 1–3 days."
                : "Earth-directed CMEs can trigger aurora in 1–3 days."}
            </div>
          </div>
        </div>
      )}

      {/* Live SDO imagery */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-[#0c1222] border border-[#1e2937] rounded-xl overflow-hidden">
          <div className="flex items-start justify-between px-4 py-3 border-b border-[#1e2937]">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 text-[#64748b] text-xs">
                <Sun className="w-4 h-4" /> SUNSPOTS
              </div>
              {sunCtx !== null && solarActivity.sunspotNumber !== null ? (
                <>
                  <div className="text-[13px] font-semibold mt-0.5" style={{ color: sunCtx.color }}>
                    {solarActivity.sunspotNumber} · {sunCtx.label}
                  </div>
                  {!!solarActivity.regionsError && (
                    <div className="text-[10px] text-amber-400/70">data delayed</div>
                  )}
                </>
              ) : solarActivity.regionsError ? (
                <div className="text-[10px] text-amber-400/70 mt-0.5">data delayed</div>
              ) : null}
            </div>
            {solarActivity.sunspotNumber !== null && (
              <button
                onClick={() => setOpenModal("sunspot")}
                className="text-xs text-[#64748b] hover:text-[#94a3b8] transition-colors flex items-center gap-0.5"
              >
                Details <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <SdoImage
            src={SDO_SUNSPOT_URL}
            alt="Live SDO HMI Continuum image of the solar disk showing sunspot regions"
          />

          <div className="px-4 pt-3 pb-2 space-y-2.5">
            <p className="text-[10px] text-[#475569] leading-relaxed">
              <span className="text-[#64748b] font-medium">HMI Continuum</span> — visible-light
              view of the solar disk. Sunspot groups are the source of flares and CMEs. Active
              regions near the center of the disk are Earth-facing and most relevant to watch
              for aurora potential.
            </p>
            <div className="flex items-center justify-between pb-1">
              <span className="text-[9px] text-[#334155]">Updates every ~15 min</span>
              <a
                href={SDO_DATA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#475569] hover:text-[#64748b] transition-colors"
              >
                View full data on NASA SDO ↗
              </a>
            </div>
          </div>
        </div>

        <div className="bg-[#0c1222] border border-[#1e2937] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2937]">
            <div className="flex items-center gap-2 text-[#64748b] text-xs">
              <TrendingUp className="w-4 h-4" /> CORONAL HOLES
            </div>
            <button
              onClick={() => setOpenModal("coronal")}
              className="text-xs text-[#64748b] hover:text-[#94a3b8] transition-colors flex items-center gap-0.5"
            >
              Details <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <SdoImage
            src={SDO_CORONAL_URL}
            alt="Live SDO AIA 193Å extreme ultraviolet image showing coronal holes as dark regions"
          />

          <div className="px-4 pt-3 pb-2 space-y-2.5">
            <p className="text-[10px] text-[#475569] leading-relaxed">
              <span className="text-[#64748b] font-medium">AIA 193Å</span> extreme ultraviolet
              view. Dark patches are coronal holes — tap Details to learn how they affect aurora.
            </p>
            <div className="flex items-center justify-between pb-1">
              <span className="text-[9px] text-[#334155]">Updates every ~15 min</span>
              <a
                href={SDO_DATA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#475569] hover:text-[#64748b] transition-colors"
              >
                View full data on NASA SDO ↗
              </a>
            </div>
          </div>
        </div>
      </div>

      {solarActivity.error && (
        <div className="mt-2 text-[10px] text-amber-400">
          NOAA data temporarily unavailable — showing last known values.
          {solarActivity.isFetching && " Retrying…"}
        </div>
      )}

      <div className="text-[10px] text-[#64748b] mt-3">
        NOAA SWPC data · NASA SDO imagery · Flares update frequently; CMEs when analyzed; sunspots daily.
        {solarActivity.flareTime && (
          <span className="ml-2">
            Flares last updated{" "}
            {formatDistanceToNow(new Date(solarActivity.flareTime), { addSuffix: true })}
          </span>
        )}
      </div>

      {openModal === "flare" && latestFlare && (
        <FlareModal
          flare={latestFlare}
          recentCmes={solarActivity.recentCmes}
          onClose={closeModal}
        />
      )}
      {openModal === "cme" && (
        <CmeModal
          recentCmes={solarActivity.recentCmes}
          onClose={closeModal}
        />
      )}
      {openModal === "sunspot" && solarActivity.sunspotNumber !== null && (
        <SunspotModal
          sunspotNumber={solarActivity.sunspotNumber}
          onClose={closeModal}
        />
      )}
      {openModal === "coronal" && (
        <CoronalModal onClose={closeModal} />
      )}
    </div>
  );
}
