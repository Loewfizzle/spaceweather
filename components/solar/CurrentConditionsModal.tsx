"use client";

import { X, ChevronRight, Activity } from "lucide-react";
import { useUserLocationContext } from "../../lib/context/UserLocationContext";

// ── Dynamic blurb helpers ─────────────────────────────────────────────────────

function windBlurb(speed: number | null): { status: string; body: string } {
  if (speed === null) return { status: "no data", body: "Solar wind readings aren't available right now." };
  const s = Math.round(speed);
  if (speed >= 800) return { status: `${s} km/s — very fast`, body: `At ${s} km/s the solar wind is screaming — this is storm-level activity. Massive amounts of energy are being delivered to Earth's magnetosphere. Combined with a southward Bz, aurora conditions are as good as it gets.` };
  if (speed >= 600) return { status: `${s} km/s — fast`, body: `At ${s} km/s the solar wind is well above normal. It's delivering more energy than usual to Earth's magnetosphere, making aurora more likely — especially if Bz dips southward.` };
  if (speed >= 450) return { status: `${s} km/s — elevated`, body: `At ${s} km/s the solar wind is slightly above the quiet baseline. Not dramatic on its own, but if Bz tips southward this could contribute to activity.` };
  if (speed >= 300) return { status: `${s} km/s — normal`, body: `At ${s} km/s the solar wind is flowing at a typical background speed. This alone won't trigger aurora — it's the direction of the magnetic field (Bz) and the Kp index that will tell the real story.` };
  return { status: `${s} km/s — slow`, body: `At ${s} km/s the solar wind is unusually slow. Very little energy is reaching Earth's magnetosphere right now.` };
}

function bzBlurb(bz: number | null): { status: string; body: string } {
  if (bz === null) return { status: "no data", body: "Bz readings aren't available right now." };
  const v = bz.toFixed(1);
  if (bz <= -15) return { status: `${v} nT — strongly southward`, body: `Bz is strongly southward at ${v} nT — about as favorable as it gets. The interplanetary magnetic field has swung south, which essentially opens a door between the solar wind and Earth's magnetosphere. Energy is pouring in and fueling aurora.` };
  if (bz <= -5)  return { status: `${v} nT — southward`, body: `Bz is southward at ${v} nT — a genuinely favorable condition. The magnetic door is partially open, solar wind energy is entering the magnetosphere, and geomagnetic activity is ticking up.` };
  if (bz <= -2)  return { status: `${v} nT — mildly southward`, body: `Bz is mildly southward at ${v} nT — slightly favorable but not strongly so. A deeper southward dip and a longer hold would meaningfully improve aurora chances.` };
  if (bz <= 2)   return { status: `${v} nT — near neutral`, body: `Bz is hovering near zero at ${v} nT — not helping, not hurting. All eyes on which direction it tips next. If it drops southward and holds, conditions can improve quickly.` };
  if (bz <= 10)  return { status: `${v} nT — northward`, body: `Bz is northward at ${v} nT and actively suppressing aurora. Even if solar wind speed is elevated, a northward Bz acts like a closed door — solar wind energy can't enter the magnetosphere efficiently.` };
  return { status: `${v} nT — strongly northward`, body: `Bz is strongly northward at ${v} nT — a significant blocker. Aurora activity is mostly shut down while this holds. Watch for it to flip.` };
}

function kpBlurb(kp: number | null): { status: string; body: string } {
  if (kp === null) return { status: "no data", body: "Kp readings aren't available right now." };
  const v = kp.toFixed(1);
  if (kp >= 8) return { status: `Kp ${v} — extreme storm (G4/G5)`, body: `This is a major geomagnetic event. Aurora is potentially visible across most of the US, including states that almost never see it. If you can get outside right now, do it.` };
  if (kp >= 7) return { status: `Kp ${v} — strong storm (G3)`, body: `Strong geomagnetic storm underway. Aurora is likely visible well into the mid-US and possibly as far south as the mid-Atlantic under dark skies.` };
  if (kp >= 6) return { status: `Kp ${v} — moderate storm (G2)`, body: `A moderate geomagnetic storm. Aurora should be visible across the northern US — upper Midwest, Great Lakes, Northeast, Pacific Northwest. Even somewhat light-polluted skies might work.` };
  if (kp >= 5) return { status: `Kp ${v} — minor storm (G1)`, body: `A minor storm — the threshold where aurora becomes reliably visible across the northern tier of the US. Get away from city lights and look north.` };
  if (kp >= 4) return { status: `Kp ${v} — enhanced`, body: `Above the quiet threshold. Aurora is possible in the far northern US and southern Canada, but you'll need genuinely dark rural skies to see it.` };
  if (kp >= 3) return { status: `Kp ${v} — mild activity`, body: `Mild geomagnetic activity. Aurora is reliably visible in Alaska and northern Canada. The very northern fringe of the lower 48 is borderline — patience and dark skies required.` };
  if (kp >= 1) return { status: `Kp ${v} — quiet`, body: `Conditions are quiet. Aurora is visible in Alaska and the high Arctic, but unlikely to make it further south at this level.` };
  return { status: `Kp ${v} — very quiet`, body: `Geomagnetically very quiet. Very little aurora activity anywhere on Earth right now.` };
}

function ovationNABlurb(prob: number | null, processed?: boolean): string {
  if (!processed || prob === null) return "OVATION data isn't available right now.";
  if (prob <= 0)  return "The OVATION model is showing essentially no aurora signal over North America. The oval is sitting well north of the US.";
  if (prob < 5)   return `At ${Math.round(prob)}%, the OVATION signal is very faint. The aurora oval is mostly above Canada — very little reaching the lower 48 right now.`;
  if (prob < 15)  return `At ${Math.round(prob)}%, there's a weak aurora signal over parts of North America. Activity is mainly confined to Alaska and the northern fringe of the US.`;
  if (prob < 30)  return `At ${Math.round(prob)}%, the OVATION model is showing a meaningful aurora signal over North America. Activity is reaching toward the northern US.`;
  if (prob < 50)  return `At ${Math.round(prob)}%, OVATION is showing significant aurora activity over North America. Conditions are favorable for the northern US.`;
  return `At ${Math.round(prob)}%, OVATION is showing a very active aurora oval. This is a strong aurora event.`;
}

function ovationUserBlurb(prob: number | null, label?: string | null): string | null {
  if (prob === null) return null;
  const name = label ?? "Your location";
  if (prob <= 1)  return `${name} is showing less than 1% on the OVATION model — the aurora oval isn't reaching your area right now.`;
  if (prob < 10)  return `${name} is showing ${Math.round(prob)}% — a faint signal at your latitude. Aurora could be present but would be very faint and hard to see.`;
  if (prob < 25)  return `${name} is showing ${Math.round(prob)}% — a marginal but real signal. Dark skies and patience could be rewarded tonight.`;
  if (prob < 50)  return `${name} is showing ${Math.round(prob)}% — a solid reading. Aurora is plausibly visible from your location right now. Worth going outside.`;
  return `${name} is showing ${Math.round(prob)}% — a strong OVATION signal at your location. Aurora overhead right now.`;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface CurrentConditionsModalProps {
  kp: number | null;
  bz: number | null;
  solarWindSpeed: number | null;
  maxAuroraProbNA: number | null;
  ovationProcessed?: boolean;
  userLocationProb?: number | null;
  onClose: () => void;
}

export function CurrentConditionsModal({
  kp,
  bz,
  solarWindSpeed,
  maxAuroraProbNA,
  ovationProcessed,
  userLocationProb,
  onClose,
}: CurrentConditionsModalProps) {
  const { userLocationLabel } = useUserLocationContext();

  const wind = windBlurb(solarWindSpeed);
  const bzData = bzBlurb(bz);
  const kpData = kpBlurb(kp);
  const ovationNA = ovationNABlurb(maxAuroraProbNA, ovationProcessed);
  const ovationUser = ovationUserBlurb(userLocationProb ?? null, userLocationLabel);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Live conditions explained"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="bg-[#0d1425] border border-[#1e2937] rounded-2xl w-full max-w-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-0">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#64748b]" />
              <span className="uppercase tracking-[2px] text-[10px] text-[#64748b]">
                Live Conditions
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

          <div className="px-5 pb-5 pt-4 space-y-5">

            {/* 1 — The key distinction */}
            <div className="rounded-lg border border-[#1e2937] bg-[#0a0f1e] px-4 py-3">
              <div className="text-xs font-medium text-[#94a3b8] mb-1.5">Live now vs. tonight&apos;s forecast</div>
              <p className="text-[12px] text-[#64748b] leading-relaxed">
                <span className="text-[#94a3b8] font-semibold">Live Conditions</span> is the real-time
                feed — data from NOAA satellites updated minute by minute, like looking out the window
                right now.{" "}
                <span className="text-[#94a3b8] font-semibold">Tonight&apos;s Forecast</span> is the
                big-picture prediction for the night ahead — a 36-hour outlook that tells you when
                conditions might peak after sunset. Both matter; this section is about what&apos;s happening
                this instant.
              </p>
            </div>

            {/* 2 — Solar wind */}
            <div>
              <div className="text-xs font-medium text-[#94a3b8] mb-1">Solar Wind</div>
              <div className="text-[11px] text-[#475569] mb-1.5">{wind.status}</div>
              <p className="text-[12px] text-[#64748b] leading-relaxed">
                The Sun constantly blows a stream of charged particles into space — that&apos;s the solar
                wind. When it speeds up, it delivers more energy to Earth&apos;s magnetic field and makes
                aurora more likely. {wind.body}
              </p>
            </div>

            {/* 3 — IMF Bz */}
            <div>
              <div className="text-xs font-medium text-[#94a3b8] mb-1">IMF Bz</div>
              <div className="text-[11px] text-[#475569] mb-1.5">{bzData.status}</div>
              <p className="text-[12px] text-[#64748b] leading-relaxed">
                Bz measures the north-south direction of the magnetic field embedded in the solar wind.
                Southward (negative) means the fields line up with Earth&apos;s and energy flows in —
                that&apos;s what drives aurora. Northward (positive) blocks it almost entirely.{" "}
                {bzData.body}
              </p>
            </div>

            {/* 4 — Planetary Kp */}
            <div>
              <div className="text-xs font-medium text-[#94a3b8] mb-1">Planetary Kp — live reading</div>
              <div className="text-[11px] text-[#475569] mb-1.5">{kpData.status}</div>
              <p className="text-[12px] text-[#64748b] leading-relaxed">
                Kp is a 0–9 scale of how disturbed Earth&apos;s magnetic field is right now, averaged
                from stations worldwide. This is the <span className="text-[#94a3b8]">current live reading</span> —
                different from the forecasted Kp in Tonight&apos;s Forecast, which looks ahead. Higher
                Kp means aurora reaches further south.{" "}
                {kpData.body}
              </p>
            </div>

            {/* 5 — OVATION */}
            <div>
              <div className="text-xs font-medium text-[#94a3b8] mb-1">NOAA OVATION Model</div>
              <p className="text-[12px] text-[#64748b] leading-relaxed mb-2">
                OVATION is a scientific model from NOAA that analyses live solar wind data and calculates
                where the aurora oval is and how intense it is right now. The percentage shown on the
                card is the <span className="text-[#94a3b8]">peak model output anywhere in North America</span> —
                not a simple &ldquo;chance of seeing aurora.&rdquo; Think of it more like a radar return:
                0% means the oval is well above Canada; 50%+ means a major aurora event is in progress
                over the continent.
              </p>
              <p className="text-[12px] text-[#64748b] leading-relaxed">
                {ovationNA}
              </p>
              {ovationUser && (
                <div className="mt-2.5 rounded-lg border border-[#1e2937] bg-[#0a0f1e] px-3 py-2.5">
                  <p className="text-[12px] text-[#64748b] leading-relaxed">{ovationUser}</p>
                </div>
              )}
            </div>

            {/* NOAA link */}
            <a
              href="https://www.swpc.noaa.gov/products/real-time-solar-wind"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full text-xs text-[#475569] hover:text-[#64748b] transition-colors pt-3 border-t border-[#1e2937]"
            >
              <span>Real-Time Solar Wind on NOAA SWPC</span>
              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
