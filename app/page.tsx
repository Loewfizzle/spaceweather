"use client";

import {
  Bell,
  Wind,
  Activity,
  Satellite,
  Zap,
  RefreshCw,
  Sun,
  TrendingUp,
  Cloud,
  ChevronDown,
} from "lucide-react";
import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { formatDistanceToNow } from "date-fns";
import { useCurrentConditions, useKpData, useSolarActivity, getTonightOutlook, useSkyConditions, type SkyCondition } from "../lib/use-noaa-data";

// SSR-safe Leaflet map
const AuroraMap = dynamic(() => import("../components/AuroraMap"), {
  ssr: false,
  loading: () => (
    <div className="map-placeholder h-[420px] sm:h-[480px] md:h-[520px] flex items-center justify-center">
      <div className="text-center">
        <div className="h-4 w-32 bg-[#1e2937] rounded animate-pulse mb-2 mx-auto" />
        <div className="text-[#64748b] text-sm">Preparing live aurora map…</div>
      </div>
    </div>
  ),
});

// Register Chart.js components once
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Lightweight Suspense fallbacks matching the app's premium dark skeleton style
const MapSectionSkeleton = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-3">
      <div>
        <div className="section-title">AURORA MAP — OVATION MODEL</div>
        <div className="h-4 w-64 bg-[#1e2937] rounded animate-pulse" />
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-20 bg-[#1e2937] rounded-full animate-pulse" />
        ))}
        <div className="h-8 w-28 bg-[#1e2937] rounded-full animate-pulse ml-2" />
      </div>
    </div>
    <div className="map-placeholder h-[420px] sm:h-[480px] md:h-[520px] flex items-center justify-center">
      <div className="text-center">
        <div className="h-4 w-32 bg-[#1e2937] rounded animate-pulse mb-2 mx-auto" />
        <div className="text-[#64748b] text-sm">Loading interactive map…</div>
      </div>
    </div>
  </div>
);

const KpOutlookSkeleton = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
    <div className="section-title">KP OUTLOOK + MICHIGAN FORECAST</div>
    <div className="card p-6">
      <div className="h-56 bg-[#1e2937] rounded-xl animate-pulse flex items-center justify-center">
        <div className="text-[#64748b] text-sm">Loading Kp history…</div>
      </div>
      <div className="mt-5 grid sm:grid-cols-2 gap-4">
        <div className="h-4 w-3/4 bg-[#1e2937] rounded animate-pulse" />
        <div className="h-4 w-2/3 bg-[#1e2937] rounded animate-pulse" />
      </div>
    </div>
  </div>
);

const SolarActivitySkeleton = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
    <div className="section-title flex items-baseline justify-between">
      <span>SOLAR ACTIVITY</span>
      <div className="h-3 w-56 bg-[#1e2937] rounded animate-pulse" />
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="metric">
          <div className="h-3 w-16 bg-[#1e2937] rounded animate-pulse mb-3" />
          <div className="h-8 w-14 bg-[#1e2937] rounded animate-pulse mb-1" />
          <div className="h-3 w-20 bg-[#1e2937] rounded animate-pulse" />
        </div>
      ))}
    </div>
  </div>
);

// Alert threshold presets (module scope for stability + used by effect, handler, and render)
const ALERT_THRESHOLDS = {
  sensitive: { kp: 3, prob: 10 },
  balanced: { kp: 4, prob: 15 },
  strong: { kp: 5, prob: 25 },
} as const;

export default function AuroraWatch() {
  const {
    kp,
    kpTime,
    maxAuroraProbNA,
    solarWindSpeed,
    solarWindDensity,
    bz,
    michiganGuidance,
    riskLevel,
    isLoading,
    error,
    refetchAll,
  } = useCurrentConditions();

  // New solar activity data (flares, CMEs, sunspots, coronal holes)
  const solarActivity = useSolarActivity();

  const tonightOutlook = getTonightOutlook(
    kp,
    bz,
    maxAuroraProbNA,
    solarActivity.recentCmes,
    solarActivity.latestFlare
  );

  const skyConditions = useSkyConditions();

  // Global last updated timestamp across main data sources for perceived performance / trust
  const lastUpdatedTimes = [
    kpTime ? new Date(kpTime) : null,
    solarActivity.flareTime ? new Date(solarActivity.flareTime) : null,
    solarActivity.alertsTime ? new Date(solarActivity.alertsTime) : null,
    solarActivity.regionsTime ? new Date(solarActivity.regionsTime) : null,
  ].filter((d): d is Date => d !== null);

  const latestGlobalUpdate =
    lastUpdatedTimes.length > 0
      ? new Date(Math.max(...lastUpdatedTimes.map((d) => d.getTime())))
      : null;

  // Map recenter control (passed to the dynamic map)
  const [mapTarget, setMapTarget] = useState<{
    center: [number, number];
    zoom: number;
  } | null>(null);

  // User controllable min probability for map points (makes OVATION viz much more useful)
  const [minProb, setMinProb] = useState(3);

  // Kp history for chart
  const kpQuery = useKpData();
  const kpHistory = useMemo(() => kpQuery.data || [], [kpQuery.data]);

  // Notifications state - permission is checked on demand / after user action
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "default";
  });

  // Use ref for throttle to avoid setState in effect (lint + perf)
  const lastNotifiedRef = useRef<number>(0);

  // Load throttle from storage once on mount (client only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("aw_last_notified");
      if (stored) lastNotifiedRef.current = parseInt(stored, 10);
    }
  }, []);

  // Notifications v2: persisted user prefs (enable + sensitivity for thresholds)
  // These are independent of browser Notification.permission (which gates delivery)
  const [alertsEnabled, setAlertsEnabledState] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const v = localStorage.getItem("aw_alerts_enabled");
      return v === null ? true : v === "1";
    }
    return true;
  });
  const [alertSensitivity, setAlertSensitivityState] = useState<
    "sensitive" | "balanced" | "strong"
  >(() => {
    if (typeof window !== "undefined") {
      const v = localStorage.getItem("aw_alert_sensitivity") as
        | "sensitive"
        | "balanced"
        | "strong"
        | null;
      return v === "sensitive" || v === "strong" ? v : "balanced";
    }
    return "balanced";
  });

  // State for expandable educational section (collapsed by default)
  const [isDataInfoExpanded, setIsDataInfoExpanded] = useState(false);

  const setAlertsEnabled = (val: boolean) => {
    setAlertsEnabledState(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("aw_alerts_enabled", val ? "1" : "0");
    }
  };
  const setAlertSensitivity = (val: "sensitive" | "balanced" | "strong") => {
    setAlertSensitivityState(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("aw_alert_sensitivity", val);
    }
  };

  // Update permission after user explicitly requests it (in handleEnableAlerts)

  const chartData = useMemo(() => {
    // Last ~12 entries (~36 hours of 3h Kp data)
    const recent = kpHistory.slice(-12);
    const labels = recent.map((entry) => {
      const d = new Date(entry.time_tag);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    });
    const values = recent.map((entry) => entry.Kp);

    return {
      labels,
      datasets: [
        {
          label: "Kp Index",
          data: values,
          borderColor: "#22c55e",
          backgroundColor: "rgba(34, 197, 94, 0.15)",
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 2.5,
          pointHoverRadius: 4,
          pointBackgroundColor: "#22c55e",
        },
      ],
    };
  }, [kpHistory]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        min: 0,
        max: 9,
        ticks: { color: "#64748b", stepSize: 1, font: { size: 11 } },
        grid: { color: "#1e2937" },
      },
      x: {
        ticks: { color: "#64748b", font: { size: 10 } },
        grid: { color: "#1e2937" },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0f1425",
        borderColor: "#1e2937",
        borderWidth: 1,
        titleColor: "#f1f5f9",
        bodyColor: "#cbd5e1",
      },
    },
  };

  // Auto-trigger browser notification when conditions look good for Michigan
  // Throttled to avoid spam (min 30 min between notifications)
  // Respects user alertsEnabled toggle + chosen sensitivity threshold
  useEffect(() => {
    if (
      notificationPermission !== "granted" ||
      kp === null ||
      isLoading ||
      !alertsEnabled
    )
      return;

    const now = Date.now();
    const last = lastNotifiedRef.current;
    if (now - last < 1000 * 60 * 30) return;

    const thresh = ALERT_THRESHOLDS[alertSensitivity];
    const likelyForMI =
      kp >= thresh.kp ||
      (maxAuroraProbNA !== null && maxAuroraProbNA >= thresh.prob) ||
      (bz !== null && bz <= -5);

    if (likelyForMI) {
      const body = `Kp ${kp.toFixed(1)}. Aurora may be visible in parts of Michigan tonight. Check the map and current conditions.`;
      try {
        new Notification("AuroraWatch Alert", {
          body,
          tag: "aurorawatch-mi",
        });
        lastNotifiedRef.current = now;
        localStorage.setItem("aw_last_notified", now.toString());
      } catch (e) {
        // Notifications may be blocked or not supported in some contexts
        console.warn("Could not show notification", e);
      }
    }
  }, [
    kp,
    maxAuroraProbNA,
    bz,
    notificationPermission,
    isLoading,
    alertsEnabled,
    alertSensitivity,
  ]);

  const formatTime = (iso?: string | null) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " UTC";
    } catch {
      return iso;
    }
  };

  const kpClass = kp === null
    ? "kp-low"
    : kp >= 5
    ? "kp-high"
    : kp >= 4
    ? "kp-moderate"
    : "kp-low";

  const handleEnableAlerts = async () => {
    if (!("Notification" in window)) {
      alert("Browser notifications not supported in this environment.");
      return;
    }

    if (notificationPermission === "granted") {
      // Test notification (works even if user has toggled auto alerts off)
      try {
        const thresh = ALERT_THRESHOLDS[alertSensitivity];
        new Notification("AuroraWatch Test", {
          body: `Test. You will receive real alerts when Kp ≥ ${thresh.kp} or OVATION ≥ ${thresh.prob}% (or strong −Bz) for Michigan.`,
          tag: "aurorawatch-test",
        });
      } catch (e) {
        console.warn(e);
      }
      return;
    }

    const perm = await Notification.requestPermission();
    setNotificationPermission(perm);

    if (perm === "granted") {
      // Turn auto alerts on by default when user grants permission
      setAlertsEnabled(true);
      // Confirmation notification
      try {
        new Notification("AuroraWatch", {
          body: "Alerts enabled. We'll notify you when aurora looks likely over Michigan.",
        });
      } catch {}
    }
  };

  return (
    <div className="min-h-screen pb-12">
      {/* Sticky Header */}
      <header className="header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-emerald-400 via-cyan-400 to-violet-400 flex items-center justify-center flex-shrink-0">
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#05070f]" />
            </div>
            <div>
              <div className="font-semibold tracking-tighter text-lg sm:text-xl">AuroraWatch</div>
              <div className="text-[9px] sm:text-[10px] text-[#64748b] -mt-0.5 leading-none">
                NOAA SWPC<span className="hidden sm:inline"> • Michigan Focus</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Live Kp status pill */}
            <div
              className={`kp-pill ${kpClass}`}
              title="Planetary K-index (live from NOAA)"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Kp {kp !== null ? kp.toFixed(1) : "—"}</span>
            </div>

            {/* Michigan risk level pill */}
            {riskLevel && (
              <div
                className={`risk-pill risk-${riskLevel.toLowerCase()}`}
                title="Current aurora visibility risk for Michigan (Kp + OVATION + Bz)"
              >
                MI {riskLevel}
              </div>
            )}

            {/* Consolidated freshness indicator — single source of truth (latestGlobalUpdate), calm, non-redundant.
               Mobile: compact dot + "LIVE". Desktop: live dot + precise relative time. */}
            {latestGlobalUpdate && (
              <div
                className="flex items-center gap-1 text-[10px] text-[#64748b] tabular-nums"
                title="Most recent data across all sources"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#22c55e]"></span>
                </span>
                <span className="hidden sm:inline">
                  {formatDistanceToNow(latestGlobalUpdate, { addSuffix: true })}
                </span>
                <span className="sm:hidden text-[#22c55e] font-medium">LIVE</span>
              </div>
            )}

            {/* Refresh button — icon-only on mobile for breathing room, full label + larger tap target on larger screens */}
            <button
              onClick={() => {
                refetchAll();
                solarActivity.refetchAll();
                skyConditions.refetchAll();
              }}
              disabled={isLoading || solarActivity.isLoading || skyConditions.isLoading}
              className="button flex items-center justify-center gap-1.5 text-xs px-2.5 sm:px-3 py-1 min-h-[38px] sm:min-h-0"
              title="Refresh live data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading || solarActivity.isLoading || skyConditions.isLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero + Tonight’s Michigan Outlook */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-8">
        <div className="max-w-3xl">
          <div className="uppercase tracking-[2.5px] text-[10px] text-[#64748b] mb-3">LIVE • NOAA SWPC DATA</div>
          <h1 className="text-6xl sm:text-7xl font-semibold tracking-tighter leading-[0.92] mb-5">
            Aurora &amp; space<br />weather for the<br />United States
          </h1>
          <p className="text-2xl text-[#94a3b8] tracking-tight max-w-2xl">
            Real-time OVATION aurora forecasts and planetary K-index.
            Special attention to Michigan and the Great Lakes.
          </p>
        </div>

        {/* Tonight’s Michigan Outlook — new prominent hero card */}
        <div 
          className="mt-8 card p-6 max-w-3xl border-l-4" 
          style={{ borderLeftColor: tonightOutlook.accentColor }}
        >
          <div>
            <div className="uppercase tracking-[2.5px] text-[10px] text-[#64748b] mb-2">
              TONIGHT’S MICHIGAN OUTLOOK
            </div>

            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
              <div 
                className="text-4xl font-semibold tracking-tighter"
                style={{ color: tonightOutlook.accentColor }}
              >
                {tonightOutlook.status}
              </div>
              {tonightOutlook.drivers && tonightOutlook.status !== 'Loading' && (
                <div className="text-sm text-[#64748b] tabular-nums font-medium">
                  {tonightOutlook.drivers}
                </div>
              )}
            </div>

            <p className="text-[#cbd5e1] text-[15px] leading-relaxed mb-3">
              {tonightOutlook.message}
            </p>

            {tonightOutlook.reasons.length > 0 && (
              <div className="space-y-1 mb-1">
                {tonightOutlook.reasons.map((reason, idx) => (
                  <div key={idx} className="text-sm text-[#94a3b8] flex items-start gap-2">
                    <span 
                      className="mt-1.5 block h-1 w-1 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: tonightOutlook.accentColor }} 
                    />
                    {reason}
                  </div>
                ))}
              </div>
            )}
          </div>

          {(isLoading || solarActivity.isLoading) && (
            <div className="mt-3 h-4 w-2/3 bg-[#1e2937] rounded animate-pulse" />
          )}
          {(error || solarActivity.error) && (
            <div className="mt-2 text-xs text-red-400">
              Error loading outlook. Using cached values if available.
            </div>
          )}
        </div>

        {/* Sky Conditions — cloud cover for tonight in key Michigan spots */}
        <div className="mt-6 max-w-3xl">
          <div className="section-title flex items-baseline justify-between mb-3">
            <span>SKY CONDITIONS FOR TONIGHT</span>
            {skyConditions.conditions.length > 0 && (
              <span className="text-[10px] font-normal text-[#64748b] normal-case tracking-normal">
                Open-Meteo • updates ~45 min
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {skyConditions.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="metric p-4">
                  <div className="h-3 w-20 bg-[#1e2937] rounded animate-pulse mb-2" />
                  <div className="h-6 w-12 bg-[#1e2937] rounded animate-pulse mb-1" />
                  <div className="h-3 w-24 bg-[#1e2937] rounded animate-pulse" />
                </div>
              ))
            ) : skyConditions.error ? (
              <div className="metric col-span-1 sm:col-span-3 text-red-400 text-sm p-4">
                Unable to load sky conditions. Check your connection.
              </div>
            ) : (
              skyConditions.conditions.map((cond: SkyCondition, idx: number) => {
                const color =
                  cond.status === "Clear"
                    ? "#22c55e"
                    : cond.status === "Partly Cloudy"
                    ? "#eab308"
                    : "#64748b";
                return (
                  <div key={idx} className="metric p-4">
                    <div className="flex items-center gap-2 text-[#64748b] text-xs mb-1.5">
                      <Cloud className="w-3.5 h-3.5" /> {cond.name}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <div
                        className="text-3xl font-semibold tracking-tighter tabular-nums"
                        style={{ color }}
                      >
                        {cond.cloudCover}%
                      </div>
                      <div className="text-sm font-medium" style={{ color }}>
                        {cond.status}
                      </div>
                    </div>
                    <div className="text-[10px] text-[#475569] mt-1 leading-tight">
                      {cond.note}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Metrics Row - now live with skeleton loading */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
        <div className="section-title flex items-baseline justify-between">
          <span>CURRENT CONDITIONS</span>
          <span className="text-[10px] font-normal text-[#64748b] normal-case tracking-normal">
            {kpTime ? `updated ${formatDistanceToNow(new Date(kpTime), { addSuffix: true })}` : 'syncing…'} • auto
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {isLoading ? (
            // Simple skeletons for premium loading feel
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="metric">
                <div className="h-3 w-16 bg-[#1e2937] rounded animate-pulse mb-3" />
                <div className="h-8 w-14 bg-[#1e2937] rounded animate-pulse mb-1" />
                <div className="h-3 w-20 bg-[#1e2937] rounded animate-pulse" />
              </div>
            ))
          ) : (
            <>
              <div className="metric">
                <div className="flex items-center gap-2 text-[#64748b] text-xs mb-2.5">
                  <Wind className="w-4 h-4" /> SOLAR WIND
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
              </div>

              <div className="metric">
                <div className="flex items-center gap-2 text-[#64748b] text-xs mb-2.5">
                  <Zap className="w-4 h-4" /> IMF Bz
                </div>
                <div className="text-4xl font-semibold tracking-tighter tabular-nums">
                  {bz !== null ? bz.toFixed(1) : "—"}
                </div>
                <div className="text-sm text-[#64748b] -mt-1">
                  nT <span className="text-xs ml-1">• Southward = favorable</span>
                </div>
              </div>

              <div className="metric">
                <div className="flex items-center gap-2 text-[#64748b] text-xs mb-2.5">
                  <Activity className="w-4 h-4" /> PLANETARY Kp
                </div>
                <div className="text-4xl font-semibold tracking-tighter tabular-nums">
                  {kp !== null ? kp.toFixed(1) : "—"}
                </div>
                <div className="text-sm text-[#64748b] -mt-1">Latest 3-hour • {kp !== null && kp < 4 ? "Quiet" : "Active"}</div>
              </div>

              <div className="metric">
                <div className="flex items-center gap-2 text-[#64748b] text-xs mb-2.5">
                  <Satellite className="w-4 h-4" /> OVATION (NA)
                </div>
                <div className="text-4xl font-semibold tracking-tighter tabular-nums">
                  {maxAuroraProbNA !== null ? Math.round(maxAuroraProbNA) : "—"}%
                </div>
                <div className="text-sm text-[#64748b] -mt-1">Max probability (North America)</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Interactive Map Section — primary visual feature, moved significantly higher so users reach the core interactive experience early (after decision summary + current data) */}
      <Suspense fallback={<MapSectionSkeleton />}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-3">
            <div>
              <div className="section-title">AURORA MAP — OVATION MODEL</div>
              <div className="text-sm text-[#64748b]">North America • Probability of visible aurora (0–100%)</div>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <button
                className="button"
                onClick={() => setMapTarget({ center: [45.5, -86], zoom: 5.5 })}
              >
                Great Lakes
              </button>
              <button
                className="button"
                onClick={() => setMapTarget({ center: [44, -85], zoom: 6 })}
              >
                Michigan
              </button>
              <button
                className="button"
                onClick={() => setMapTarget({ center: [39, -98], zoom: 3.5 })}
              >
                Continental US
              </button>
              <button
                className="button"
                onClick={() => setMapTarget({ center: [48, -100], zoom: 3 })}
              >
                North America
              </button>

              {/* Min prob filter - powerful control for the dense OVATION data */}
              <div className="flex items-center gap-2 ml-2 text-xs text-[#64748b] bg-[#0f1425] px-2 py-1 rounded-full border border-[#1e2937]">
                <span className="font-medium">Filter ≥</span>
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={1}
                  value={minProb}
                  onChange={(e) => setMinProb(parseInt(e.target.value))}
                  className="w-20 accent-[#22c55e] cursor-pointer"
                  aria-label="Minimum aurora probability to show on map"
                />
                <span className="tabular-nums font-mono w-8 text-right text-[#22c55e]">{minProb}%</span>
                {minProb > 3 && (
                  <button
                    onClick={() => setMinProb(3)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e2937] hover:bg-[#334155] transition-colors"
                    title="Reset filter"
                  >
                    reset
                  </button>
                )}
              </div>
            </div>
            <div className="text-[10px] text-[#64748b] mt-1">Drag the slider to hide low-probability areas — very useful on mobile to focus on the aurora oval.</div>
          </div>

          <AuroraMap target={mapTarget} minProb={minProb} />
        </div>
      </Suspense>

      {/* Forecast Timeline - live Chart.js Kp history */}
      <Suspense fallback={<KpOutlookSkeleton />}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
          <div className="section-title">KP OUTLOOK + MICHIGAN FORECAST</div>
          <div className="card p-6">
            <div className="h-56">
              {kpQuery.isLoading ? (
                <div className="h-full w-full rounded-xl bg-[#1e2937] animate-pulse flex items-center justify-center">
                  <div className="text-[#64748b] text-sm">Syncing recent Kp data…</div>
                </div>
              ) : kpHistory.length > 0 ? (
                <Line data={chartData} options={chartOptions} />
              ) : (
                <div className="flex h-full items-center justify-center text-[#64748b]">No recent Kp data</div>
              )}
            </div>

            <div className="mt-5 grid sm:grid-cols-2 gap-4 text-sm">
              <div className="text-[#cbd5e1]">
                <span className="font-medium text-white">Tonight (Michigan):</span> {michiganGuidance}
              </div>
              <div className="text-[#cbd5e1]">
                <span className="font-medium text-white">Recent trend:</span>{" "}
                {kpHistory.length > 1 ? (
                  kpHistory[kpHistory.length - 1].Kp > kpHistory[kpHistory.length - 2].Kp
                    ? "Rising — elevated activity possible if trend continues."
                    : "Stable or declining — conditions quieting."
                ) : (
                  "Based on current solar wind and Bz."
                )}
              </div>
            </div>
            <div className="mt-3 text-[10px] text-[#64748b]">
              Chart shows last ~36 hours of 3-hour Kp values. Full multi-day forecasts available from NOAA.
            </div>
          </div>
        </div>
      </Suspense>

      {/* SOLAR ACTIVITY — key solar drivers for aurora (moved after Kp outlook per reorg for clearer flow: status/outlook/data/visual → forecast → drivers → learn) */}
      <Suspense fallback={<SolarActivitySkeleton />}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
          <div className="section-title flex items-baseline justify-between">
            <span>SOLAR ACTIVITY</span>
            <span className="text-[10px] font-normal text-[#64748b] normal-case tracking-normal">
              Key drivers of geomagnetic activity • Michigan-relevant
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {solarActivity.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="metric">
                  <div className="h-3 w-16 bg-[#1e2937] rounded animate-pulse mb-3" />
                  <div className="h-8 w-14 bg-[#1e2937] rounded animate-pulse mb-1" />
                  <div className="h-3 w-20 bg-[#1e2937] rounded animate-pulse" />
                </div>
              ))
            ) : solarActivity.error ? (
              <div className="metric col-span-2 md:col-span-4 text-red-400 text-sm">
                Unable to load solar data. Using cached values if available.
              </div>
            ) : (
              <>
                {/* 1. Latest Solar Flares (highest priority) */}
                <div className="metric">
                  <div className="flex items-center gap-2 text-[#64748b] text-xs mb-2.5">
                    <Zap className="w-4 h-4" /> LATEST FLARE
                  </div>
                  <div className="text-4xl font-semibold tracking-tighter tabular-nums">
                    {solarActivity.latestFlare?.max_class || solarActivity.latestFlare?.current_class || "—"}
                  </div>
                  <div className="text-sm text-[#64748b] -mt-1">
                    {solarActivity.latestFlare?.max_time
                      ? formatDistanceToNow(new Date(solarActivity.latestFlare.max_time), { addSuffix: true })
                      : solarActivity.flareTime
                      ? formatDistanceToNow(new Date(solarActivity.flareTime), { addSuffix: true })
                      : "—"}
                    {solarActivity.latestFlare?.region ? ` • Region ${solarActivity.latestFlare.region}` : ""}
                  </div>
                  <div className="text-[10px] text-[#475569] mt-1">
                    Most recent X-ray flare. Earth-facing flares are most relevant for Michigan aurora.
                  </div>
                </div>

                {/* 2. Recent / Earth-directed CMEs */}
                <div className="metric">
                  <div className="flex items-center gap-2 text-[#64748b] text-xs mb-2.5">
                    <Cloud className="w-4 h-4" /> RECENT CMEs
                  </div>
                  <div className="text-2xl font-semibold tracking-tighter tabular-nums leading-tight">
                    {solarActivity.recentCmes.length > 0
                      ? solarActivity.recentCmes
                          .map((c) => (c.speed ? `${c.speed} km/s` : "CME"))
                          .join(" / ")
                      : "—"}
                  </div>
                  <div className="text-sm text-[#64748b] -mt-1">
                    {solarActivity.recentCmes.length > 0
                      ? solarActivity.recentCmes[0].earthImpact || "Analyzed"
                      : "No recent Earth-directed CMEs reported"}
                  </div>
                  <div className="text-[10px] text-[#475569] mt-1">
                    {solarActivity.recentCmes.length > 0 && solarActivity.recentCmes[0].direction
                      ? `${solarActivity.recentCmes[0].direction} • `
                      : ""}
                    Earth-directed CMEs can trigger geomagnetic storms and aurora in 1–3 days.
                  </div>
                </div>

                {/* 3. Sunspot Number + trend context */}
                <div className="metric">
                  <div className="flex items-center gap-2 text-[#64748b] text-xs mb-2.5">
                    <Sun className="w-4 h-4" /> SUNSPOT NUMBER
                  </div>
                  <div className="text-4xl font-semibold tracking-tighter tabular-nums">
                    {solarActivity.sunspotNumber !== null ? solarActivity.sunspotNumber : "—"}
                  </div>
                  <div className="text-sm text-[#64748b] -mt-1">
                    Total active regions • Higher = more flare/CME potential
                  </div>
                  <div className="text-[10px] text-[#475569] mt-1">
                    Current solar cycle activity level. More sunspots generally mean higher aurora odds over time.
                  </div>
                </div>

                {/* 4. Coronal Holes (lighter treatment) */}
                <div className="metric">
                  <div className="flex items-center gap-2 text-[#64748b] text-xs mb-2.5">
                    <TrendingUp className="w-4 h-4" /> CORONAL HOLES
                  </div>
                  <div className="text-xl font-semibold tracking-tighter leading-snug">
                    Monitor for streams
                  </div>
                  <div className="text-sm text-[#64748b] -mt-1">
                    High-speed wind source
                  </div>
                  <div className="text-[10px] text-[#475569] mt-1">
                    {solarActivity.coronalHoleNote}
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="text-[10px] text-[#64748b] mt-2">
            Data from NOAA SWPC • Flares update frequently; CMEs when analyzed; sunspots daily.
            {solarActivity.flareTime && (
              <span className="ml-2">
                Last flare update: {formatDistanceToNow(new Date(solarActivity.flareTime), { addSuffix: true })}
              </span>
            )}
          </div>
        </div>
      </Suspense>

      {/* Understanding the Data — educational section, collapsed by default (kept collapsed; position after Solar follows logical "see the data → understand it" flow) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
        <div className="card">
          <button
            onClick={() => setIsDataInfoExpanded(!isDataInfoExpanded)}
            className="w-full flex items-center justify-between p-6 text-left"
            aria-expanded={isDataInfoExpanded}
            aria-controls="understanding-data-content"
          >
            <div>
              <div className="section-title mb-1">Understanding the Data</div>
              <div className="text-sm text-[#94a3b8]">
                Helpful context for Michigan aurora chasers
              </div>
            </div>
            <ChevronDown
              className={`w-5 h-5 text-[#64748b] transition-transform ${isDataInfoExpanded ? "rotate-180" : ""}`}
            />
          </button>

          {isDataInfoExpanded && (
            <div id="understanding-data-content" className="px-6 pb-6 text-sm text-[#cbd5e1] space-y-4 border-t border-[#1e2937] pt-4">
              <div>
                <div className="font-medium text-white mb-1">Kp Index</div>
                <p>
                  The planetary K-index measures geomagnetic activity on a scale of 0–9. For Michigan, Kp 4+ can produce aurora in the Upper Peninsula under dark skies; Kp 5+ offers a good chance there and possible visibility in northern Lower Michigan. Higher values (6–9) increase the odds dramatically, even in southern parts of the state with clear, dark conditions.
                </p>
              </div>

              <div>
                <div className="font-medium text-white mb-1">Bz (IMF)</div>
                <p>
                  Bz is the north-south component of the interplanetary magnetic field. Southward (negative) Bz is favorable for aurora because it allows solar wind energy to connect with Earth’s magnetic field. Strongly negative Bz (e.g., –5 nT or lower) combined with high solar wind speed significantly boosts chances for Michigan viewers.
                </p>
              </div>

              <div>
                <div className="font-medium text-white mb-1">OVATION Map</div>
                <p>
                  The map displays modeled probability of visible aurora based on the OVATION Prime model using real-time solar wind data. It is a forecast, not live imagery of the aurora itself. Probabilities are highest near the auroral oval; even low percentages in the Great Lakes region can mean visible aurora if skies are dark and clear.
                </p>
              </div>

              <div>
                <div className="font-medium text-white mb-1">Solar Activity Section</div>
                <p>
                  Flares indicate sudden energy releases that can precede geomagnetic disturbances. CMEs (coronal mass ejections) are large expulsions of plasma; Earth-directed ones with high speed are the main drivers of strong aurora displays 1–3 days later. Higher sunspot numbers generally mean more solar activity overall. Coronal holes produce high-speed solar wind streams that can create recurrent aurora opportunities, especially when combined with other factors.
                </p>
              </div>

              <div>
                <div className="font-medium text-white mb-1">Viewing Tips for Michigan</div>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Seek dark skies away from city lights (Upper Peninsula and northern Lower Peninsula are best).</li>
                  <li>Best chances are typically between 10pm and 2am local time, though aurora can appear earlier or later.</li>
                  <li>Watch for clear skies and a dark horizon to the north.</li>
                  <li>Even moderate Kp or low OVATION probabilities can produce visible aurora if Bz is strongly southward.</li>
                  <li>Be patient — displays can last minutes to hours and often come in waves.</li>
                </ul>
              </div>

              <div className="text-[10px] text-[#64748b] pt-2 border-t border-[#1e2937]">
                Data is provided by NOAA Space Weather Prediction Center (SWPC) for personal and educational use. This dashboard is not intended for navigation or safety-critical decisions. Conditions can change rapidly.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notifications v2 — persistent toggle, live MI risk badge, user threshold presets */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <div className="card p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            {/* Left: description + controls */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <Bell className="w-5 h-5 text-[#64748b] shrink-0" />
                <div className="font-semibold">Alerts for Michigan</div>
                {riskLevel && (
                  <span
                    className={`risk-pill risk-${riskLevel.toLowerCase()} ml-0.5`}
                    title="Live risk derived from Kp, max OVATION probability over North America, and Bz"
                  >
                    {riskLevel}
                  </span>
                )}
              </div>

              <div className="text-sm text-[#94a3b8] max-w-md">
                Browser notifications when Michigan conditions meet your threshold.
                Evaluated on every data refresh (∼5 min).
              </div>

              {/* On/Off toggle (only functional once permission granted) */}
              <div className="mt-4 flex items-center gap-3">
                <div className="text-xs text-[#64748b]">Auto alerts</div>
                <div className="inline-flex rounded-full border border-[#1e2937] text-xs overflow-hidden select-none">
                  <button
                    onClick={() => {
                      if (notificationPermission === "granted") setAlertsEnabled(true);
                    }}
                    disabled={notificationPermission !== "granted"}
                    className={`px-3 py-1 transition-colors ${
                      alertsEnabled && notificationPermission === "granted"
                        ? "bg-[#22c55e] text-[#05070f] font-medium"
                        : "text-[#64748b] hover:bg-[#1e2937]"
                    }`}
                  >
                    On
                  </button>
                  <button
                    onClick={() => setAlertsEnabled(false)}
                    disabled={notificationPermission !== "granted"}
                    className={`px-3 py-1 transition-colors ${
                      !alertsEnabled || notificationPermission !== "granted"
                        ? "bg-[#334155] text-white"
                        : "text-[#64748b] hover:bg-[#1e2937]"
                    }`}
                  >
                    Off
                  </button>
                </div>
                {notificationPermission === "granted" && alertsEnabled && (
                  <div className="text-[10px] text-[#22c55e]">Active</div>
                )}
                {notificationPermission === "denied" && (
                  <div className="text-[10px] text-red-400">Blocked in browser settings</div>
                )}
              </div>

              {/* User threshold presets (sensitivity) */}
              <div className="mt-4">
                <div className="text-xs text-[#64748b] mb-1.5">Notify me for:</div>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { key: "sensitive", label: "Sensitive", desc: "Kp ≥3 or 10%" },
                      { key: "balanced", label: "Balanced", desc: "Kp ≥4 or 15%" },
                      { key: "strong", label: "Strong only", desc: "Kp ≥5 or 25%" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setAlertSensitivity(opt.key)}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                        alertSensitivity === opt.key
                          ? "bg-[#0f1425] border-[#22c55e] text-[#22c55e]"
                          : "border-[#1e2937] text-[#94a3b8] hover:border-[#334155]"
                      }`}
                      title={opt.desc}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1 text-[10px] text-[#475569]">
                  Current threshold: Kp ≥ {ALERT_THRESHOLDS[alertSensitivity].kp} or OVATION ≥{" "}
                  {ALERT_THRESHOLDS[alertSensitivity].prob}% (plus strong southward Bz)
                </div>
              </div>

              {notificationPermission === "granted" && (
                <div className="mt-3 text-[10px] text-[#64748b]">
                  Throttled to once per 30 min • Respects Do Not Disturb
                </div>
              )}
            </div>

            {/* Right: primary action */}
            <div className="sm:shrink-0 sm:pt-1">
              <button
                onClick={handleEnableAlerts}
                className="button button-primary w-full sm:w-auto justify-center min-w-[168px]"
                disabled={notificationPermission === "denied"}
              >
                {notificationPermission === "granted"
                  ? "Send test alert"
                  : notificationPermission === "denied"
                  ? "Notifications blocked"
                  : "Enable browser alerts"}
              </button>
              {notificationPermission === "granted" && !alertsEnabled && (
                <div className="mt-2 text-[10px] text-[#64748b] text-center sm:text-left">
                  Auto alerts are paused
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#1e2937] pt-8 pb-10 text-xs text-[#64748b]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-y-2 justify-between">
            <div>
              Data provided by{" "}
              <a
                href="https://www.swpc.noaa.gov/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white"
              >
                NOAA Space Weather Prediction Center (SWPC)
              </a>
              . OVATION, planetary K-index, and real-time solar wind.
            </div>
            <div className="text-[#475569]">Not for navigation • Updates every few minutes • Built for Michigan aurora chasers</div>
          </div>
          <div className="mt-4 text-[#475569] text-[10px]">
            Last data fetch: {formatTime(kpTime)} • AuroraWatch v0.1.0
          </div>
        </div>
      </footer>
    </div>
  );
}
