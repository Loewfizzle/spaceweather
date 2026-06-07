import type { Fireball } from "../api/schemas";

export function formatFireballDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr.replace(" ", "T") + "Z");
    if (isNaN(d.getTime())) return dateStr;
    return (
      d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "UTC",
      }) + " UTC"
    );
  } catch {
    return dateStr;
  }
}

export function formatFireballLocation(fireball: Pick<Fireball, "lat" | "lon">): string {
  if (fireball.lat != null && fireball.lon != null) {
    const latStr = `${Math.abs(fireball.lat).toFixed(1)}°${fireball.lat >= 0 ? "N" : "S"}`;
    const lonStr = `${Math.abs(fireball.lon).toFixed(1)}°${fireball.lon >= 0 ? "E" : "W"}`;
    return `${latStr}, ${lonStr}`;
  }
  return "Location unavailable";
}

export function formatFireballEnergy(impactE: string | null | undefined): string {
  if (!impactE) return "—";
  const val = parseFloat(impactE);
  if (isNaN(val)) return "—";
  if (val >= 1) return `${val.toFixed(1)} kt TNT`;
  if (val >= 0.001) return `${val.toFixed(3)} kt TNT`;
  return "< 0.001 kt TNT";
}
