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

function fmtCalendarDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

// All-day span: peak night through the morning after the last peak night.
// End date is exclusive per both Google Calendar and iCalendar conventions.
function calendarSpan(shower: MeteorShower, peakDate: Date): { start: string; end: string } {
  const span = shower.peakEndDay ? 2 : 1;
  const endDate = new Date(peakDate);
  endDate.setDate(endDate.getDate() + span);
  return { start: fmtCalendarDate(peakDate), end: fmtCalendarDate(endDate) };
}

function eventDescription(shower: MeteorShower, peakDate: Date): string {
  return `Peak night(s): ${formatMeteorPeak(peakDate, shower)}\n\n${shower.description}\n\nExpected activity: ${shower.activityLevel}\n\nBest viewed after midnight from dark skies (northern latitudes ideal).`;
}

export function createGoogleCalendarLink(shower: MeteorShower, peakDate: Date): string {
  const { start, end } = calendarSpan(shower, peakDate);
  const text = encodeURIComponent(`Meteor Shower Peak: ${shower.name}`);
  const details = encodeURIComponent(eventDescription(shower, peakDate));
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}&sf=true&output=xml`;
}

// RFC 5545 §3.3.11 — backslash, semicolon, comma, and newline must be escaped in TEXT values
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

// RFC 5545 §3.1 — content lines longer than 75 octets fold with CRLF + one space
function foldIcsLine(line: string): string {
  const chunks: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    chunks.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  chunks.push(rest);
  return chunks.join("\r\n");
}

function showerSlug(shower: MeteorShower): string {
  return shower.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * iCalendar (.ics) file content for the shower's peak night — the universal
 * format for Apple Calendar, Outlook, Thunderbird, and OS default calendar apps.
 * `now` is injectable for deterministic tests (DTSTAMP is required by the spec).
 */
export function createIcsContent(shower: MeteorShower, peakDate: Date, now: Date = new Date()): string {
  const { start, end } = calendarSpan(shower, peakDate);
  const dtstamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const uid = `${showerSlug(shower)}-${peakDate.getFullYear()}@skyglow.app`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SkyGlow//Meteor Shower Peaks//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${escapeIcsText(`Meteor Shower Peak: ${shower.name}`)}`,
    `DESCRIPTION:${escapeIcsText(eventDescription(shower, peakDate))}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

export function icsFileName(shower: MeteorShower, peakDate: Date): string {
  return `${showerSlug(shower)}-${peakDate.getFullYear()}-peak.ics`;
}
