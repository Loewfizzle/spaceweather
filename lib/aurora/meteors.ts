import type { MeteorShower } from "../api/schemas";
import { MAJOR_METEOR_SHOWERS } from "../constants/meteors";

export type { MeteorShower };
export { MAJOR_METEOR_SHOWERS };

export function getNextMeteorShower(now: Date = new Date()): { shower: MeteorShower; peakDate: Date } | null {
  const thisYear = now.getFullYear();
  const candidates: Array<{ shower: MeteorShower; date: Date }> = [];

  for (let offset = 0; offset <= 1; offset++) {
    const y = thisYear + offset;
    for (const shower of MAJOR_METEOR_SHOWERS) {
      const candidate = new Date(y, shower.peakMonth - 1, shower.peakDay);
      if (offset === 0 && candidate.getTime() < now.getTime()) continue;
      candidates.push({ shower, date: candidate });
    }
  }

  // offset=1 pushes every shower from next year unconditionally; only reachable
  // if MAJOR_METEOR_SHOWERS were empty, which can't happen at runtime.
  /* v8 ignore next */
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.date.getTime() - b.date.getTime());
  const next = candidates[0];
  return { shower: next.shower, peakDate: next.date };
}

export function formatMeteorPeak(peakDate: Date, shower: MeteorShower): string {
  const month = peakDate.toLocaleString("en-US", { month: "long" });
  let str = `${month} ${peakDate.getDate()}`;
  if (shower.peakEndDay) {
    const endMonth = shower.peakEndMonth || shower.peakMonth;
    const end = new Date(peakDate.getFullYear(), endMonth - 1, shower.peakEndDay);
    if (end.getMonth() === peakDate.getMonth()) {
      str += `–${end.getDate()}`;
    } else {
      str += ` – ${end.toLocaleString("en-US", { month: "long", day: "numeric" })}`;
    }
  }
  return `${str}, ${peakDate.getFullYear()}`;
}

export function createGoogleCalendarLink(shower: MeteorShower, peakDate: Date): string {
  const y = peakDate.getFullYear();
  const m = String(peakDate.getMonth() + 1).padStart(2, "0");
  const d = String(peakDate.getDate()).padStart(2, "0");
  const start = `${y}${m}${d}`;

  const span = shower.peakEndDay ? 2 : 1;
  const endDate = new Date(peakDate);
  endDate.setDate(endDate.getDate() + span);
  const ey = endDate.getFullYear();
  const em = String(endDate.getMonth() + 1).padStart(2, "0");
  const ed = String(endDate.getDate()).padStart(2, "0");
  const end = `${ey}${em}${ed}`;

  const text = encodeURIComponent(`Meteor Shower Peak: ${shower.name}`);
  const details = encodeURIComponent(
    `Peak night(s): ${formatMeteorPeak(peakDate, shower)}\n\n${shower.description}\n\nExpected activity: ${shower.activityLevel}\n\nBest viewed after midnight from dark skies (northern latitudes ideal).`
  );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}&sf=true&output=xml`;
}
