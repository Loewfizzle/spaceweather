import { render, screen, fireEvent } from '@testing-library/react';
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

  // ── Permission states ────────────────────────────────────────────────────────

  it('shows Notifications blocked button (disabled) and "Blocked in browser settings" text when denied', () => {
    mockUseNotifications.mockReturnValue({
      ...defaultHookReturn,
      notificationPermission: 'denied' as NotificationPermission,
    });
    render(<AlertsPanel {...defaultProps} />);
    const btn = screen.getByRole('button', { name: /Notifications blocked/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/Blocked in browser settings/i)).toBeInTheDocument();
  });

  it('shows "Auto alerts are paused" when granted but alertsEnabled is false', () => {
    mockUseNotifications.mockReturnValue({
      ...defaultHookReturn,
      notificationPermission: 'granted' as NotificationPermission,
      alertsEnabled: false,
    });
    render(<AlertsPanel {...defaultProps} />);
    expect(screen.getByText(/Auto alerts are paused/i)).toBeInTheDocument();
  });

  it('shows throttle notice when permission is granted', () => {
    mockUseNotifications.mockReturnValue({
      ...defaultHookReturn,
      notificationPermission: 'granted' as NotificationPermission,
      alertsEnabled: true,
    });
    render(<AlertsPanel {...defaultProps} />);
    expect(screen.getByText(/Throttled to once per 30 min/i)).toBeInTheDocument();
  });

  it('renders notificationError message when error is present', () => {
    mockUseNotifications.mockReturnValue({
      ...defaultHookReturn,
      notificationError: 'Permission was denied by the OS',
    });
    render(<AlertsPanel {...defaultProps} />);
    expect(screen.getByText('Permission was denied by the OS')).toBeInTheDocument();
  });

  // ── Button click handlers ────────────────────────────────────────────────────

  it('clicking Enable browser alerts calls handleEnableAlerts', () => {
    const handleEnableAlerts = vi.fn();
    mockUseNotifications.mockReturnValue({ ...defaultHookReturn, handleEnableAlerts });
    render(<AlertsPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Enable browser alerts/i }));
    expect(handleEnableAlerts).toHaveBeenCalledOnce();
  });

  it('clicking On calls setAlertsEnabled(true) when permission is granted', () => {
    const setAlertsEnabled = vi.fn();
    mockUseNotifications.mockReturnValue({
      ...defaultHookReturn,
      notificationPermission: 'granted' as NotificationPermission,
      setAlertsEnabled,
    });
    render(<AlertsPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'On' }));
    expect(setAlertsEnabled).toHaveBeenCalledWith(true);
  });

  it('clicking Off calls setAlertsEnabled(false) when permission is granted', () => {
    const setAlertsEnabled = vi.fn();
    mockUseNotifications.mockReturnValue({
      ...defaultHookReturn,
      notificationPermission: 'granted' as NotificationPermission,
      setAlertsEnabled,
    });
    render(<AlertsPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Off' }));
    expect(setAlertsEnabled).toHaveBeenCalledWith(false);
  });

  it('clicking a sensitivity preset calls setAlertSensitivity with that key', () => {
    const setAlertSensitivity = vi.fn();
    mockUseNotifications.mockReturnValue({ ...defaultHookReturn, setAlertSensitivity });
    render(<AlertsPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Strong only' }));
    expect(setAlertSensitivity).toHaveBeenCalledWith('strong');
  });

  it('clicking another sensitivity preset calls setAlertSensitivity with its key', () => {
    const setAlertSensitivity = vi.fn();
    mockUseNotifications.mockReturnValue({ ...defaultHookReturn, setAlertSensitivity });
    render(<AlertsPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sensitive' }));
    expect(setAlertSensitivity).toHaveBeenCalledWith('sensitive');
  });

  // ── Alert list rendering ─────────────────────────────────────────────────────

  it('shows loading skeleton when alertsLoading is true and alerts are empty', () => {
    render(<AlertsPanel {...defaultProps} alertsLoading={true} alerts={[]} />);
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });

  it('renders multiple alerts in sequence (exercises the .map callback)', () => {
    const alerts: Alert[] = [
      {
        product_id: 'ALTK05A',
        issue_datetime: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        message: 'Product: ALTK05A\r\n\r\nFirst storm alert content.',
      },
      {
        product_id: 'ALTK07A',
        issue_datetime: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        message: 'Product: ALTK07A\r\n\r\nSecond extreme alert content.',
      },
    ];
    render(<AlertsPanel {...defaultProps} alerts={alerts} />);
    expect(screen.getByText(/First storm alert content/i)).toBeInTheDocument();
    expect(screen.getByText(/Second extreme alert content/i)).toBeInTheDocument();
  });

  // ── Risk pill ────────────────────────────────────────────────────────────────

  it('renders the risk pill when riskLevel is provided', () => {
    render(<AlertsPanel {...defaultProps} riskLevel="High" />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('does not render a risk pill when riskLevel is null', () => {
    render(<AlertsPanel {...defaultProps} riskLevel={null} />);
    expect(screen.queryByText('Moderate')).not.toBeInTheDocument();
    expect(screen.queryByText('High')).not.toBeInTheDocument();
    expect(screen.queryByText('Quiet')).not.toBeInTheDocument();
  });
});
