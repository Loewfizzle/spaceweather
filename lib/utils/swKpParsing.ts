// Pure helper — shared between tests and the SW.
// SW can't import modules, so the same logic is inlined in public/sw.js.
// If you change this function, mirror the change there too.

/**
 * Parse NOAA's tabular Kp JSON (string[][]) and return the latest Kp value.
 * Row 0 is the header; the last row is the most recent data point.
 * Returns null if the input is malformed or the Kp column is absent.
 */
export function parseKpFromTabular(raw: unknown): number | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const headers = raw[0];
  if (!Array.isArray(headers)) return null;
  const kpColIdx = (headers as unknown[]).indexOf('Kp');
  if (kpColIdx === -1) return null;
  const lastRow = raw[raw.length - 1];
  if (!Array.isArray(lastRow)) return null;
  const val = (lastRow as unknown[])[kpColIdx];
  const kp = parseFloat(String(val));
  return isNaN(kp) ? null : kp;
}
