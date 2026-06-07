import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AlertsPanel } from '../../components/AlertsPanel';
import type { Alert } from '../../lib/api/schemas';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockUseNotifications = vi.fn();
const mockUseIsMobile = vi.fn();

vi.mock('../../lib/hooks/useNotifications', () => ({
  useNotifications: (...args: unknown[]) => mockUseNotifications(...args),
  ALERT_THRESHOLDS: {
    sensitive: { kp: 3, prob: 10 },
    balanced:  { kp: 4, prob: 15 },
    strong:    { kp: 5, prob: 25 },
  },
  PRESETS: [
    { key: 'sensitive', label: 'Sensitive',   desc: 'Kp ≥3 or 10%' },
    { key: 'balanced',  label: 'Balanced',    desc: 'Kp ≥4 or 15%' },
    { key: 'strong',    label: 'Strong only', desc: 'Kp ≥5 or 25%' },
  ],
  saveSensitivity: vi.fn(),
}));

vi.mock('../../lib/hooks/useIsMobile', () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const defaultHookReturn = {
  notificationPermission: 'default' as NotificationPermission,
  alertsEnabled: false,
  alertSensitivity: 'balanced' as const,
  notificationError: null,
  swCacheDegraded: false,
  setAlertsEnabled: vi.fn(),
  setAlertSensitivity: vi.fn(),
  handleEnableAlerts: vi.fn(),
};

const defaultProps = {
  riskLevel: 'Moderate' as const,
  kp: 4,
  maxAuroraProbNA: 15,
  bz: -5,
  isLoading: false,
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockUseNotifications.mockReturnValue(defaultHookReturn);
  mockUseIsMobile.mockReturnValue(false); // desktop by default
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AlertsPanel', () => {
  it('renders the Get Notified heading on desktop', () => {
    render(<AlertsPanel {...defaultProps} />);
    expect(screen.getByText('Get Notified')).toBeInTheDocument();
  });

  it('renders mobile fallback message instead of controls on mobile', () => {
    mockUseIsMobile.mockReturnValue(true);
    render(<AlertsPanel {...defaultProps} />);
    expect(screen.getByText(/Browser notifications available on desktop/i)).toBeInTheDocument();
    expect(screen.queryByText('Get Notified')).not.toBeInTheDocument();
  });

  it('shows Enable browser alerts button when permission is default', () => {
    render(<AlertsPanel {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Enable browser alerts/i })).toBeInTheDocument();
  });

  it('shows Send test alert button when permission is granted', () => {
    mockUseNotifications.mockReturnValue({
      ...defaultHookReturn,
      notificationPermission: 'granted' as NotificationPermission,
      alertsEnabled: true,
    });
    render(<AlertsPanel {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Send test alert/i })).toBeInTheDocument();
  });

  it('shows swCacheDegraded warning when cache is degraded and alerts are active', () => {
    mockUseNotifications.mockReturnValue({
      ...defaultHookReturn,
      notificationPermission: 'granted' as NotificationPermission,
      alertsEnabled: true,
      swCacheDegraded: true,
    });
    render(<AlertsPanel {...defaultProps} />);
    expect(screen.getByText(/Background alerts limited/i)).toBeInTheDocument();
  });

  it('renders recent NOAA alerts when alerts prop is populated', () => {
    const alerts: Alert[] = [
      {
        product_id: 'ALTK05A',
        issue_datetime: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        message: 'Product: ALTK05A\r\n\r\nGeomagnetic storm conditions were observed across the northern US.',
      },
    ];
    render(<AlertsPanel {...defaultProps} alerts={alerts} />);
    expect(screen.getByText(/Geomagnetic storm conditions were observed/i)).toBeInTheDocument();
  });
});
