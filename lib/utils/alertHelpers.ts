import { formatDistanceToNow } from 'date-fns';

export function alertProductLabel(productId: string): { text: string; color: string } {
  // NOAA live format: K05A, K04A, K07A (Kp threshold alerts)
  if (/^K\d+[A-Z]$/.test(productId)) return { text: 'K-index Alert', color: '#eab308' };
  if (productId.startsWith('WATA')) {
    const g = ({ WATA07: 'G1', WATA20: 'G2', WATA30: 'G3', WATA40: 'G4', WATA50: 'G5' } as Record<string, string>)[productId];
    return { text: g ? `Storm Watch ${g}` : 'Storm Watch', color: '#22c55e' };
  }
  if (productId.startsWith('ALTK')) return { text: 'K-index Alert', color: '#eab308' };
  if (productId.startsWith('ALTTP')) return { text: 'Geomagnetic Alert', color: '#eab308' };
  if (productId.startsWith('WARPT') || productId.startsWith('ALTPX')) return { text: 'Radiation Storm', color: '#f97316' };
  if (productId.startsWith('SUM')) return { text: 'NOAA Summary', color: '#64748b' };
  if (productId.startsWith('WAR')) return { text: 'Warning', color: '#f97316' };
  if (productId.startsWith('ALT')) return { text: 'Alert', color: '#eab308' };
  return { text: 'Notice', color: '#64748b' };
}

export function alertFirstLine(message: string): string {
  // NOAA messages use \r\n\r\n as header/body separator
  const bodyStart = message.indexOf('\r\n\r\n');
  const body = bodyStart >= 0 ? message.slice(bodyStart + 4).trim() : message.trim();
  const match = body.match(/^(.{20,140}[.!?])/);
  const raw = match ? match[1] : body.slice(0, 120);
  return raw.length < body.length ? raw : raw + (body.length > 120 ? '…' : '');
}

// NOAA issue_datetime uses space instead of T ("2026-06-05 23:25:16") — normalize before parsing.
export function formatAlertAge(issueDatetime: string): string {
  try {
    return formatDistanceToNow(new Date(issueDatetime.replace(' ', 'T')), { addSuffix: true });
  } catch {
    return issueDatetime;
  }
}
