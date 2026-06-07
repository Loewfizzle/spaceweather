import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useAutoAlert } from '../../lib/hooks/useAutoAlert';
import { loadLastNotified, saveLastNotified } from '../../lib/utils/notificationStorage';

vi.mock('../../lib/utils/notificationStorage', () => ({
  ALERT_THRESHOLDS: {
    sensitive: { kp: 3, prob: 10 },
    balanced:  { kp: 4, prob: 15 },
    strong:    { kp: 5, prob: 25 },
  },
  loadLastNotified: vi.fn(() => 0),
  saveLastNotified: vi.fn(),
}));

// shouldTriggerNotification: return true when kp >= threshold kp
vi.mock('../../lib/utils/swNotifications', () => ({
  shouldTriggerNotification: vi.fn((kp: number, thresh: { kp: number }) => kp >= thresh.kp),
}));

const mockNotification = vi.fn();

const GRANTED_PARAMS = {
  kp: 5,
  maxAuroraProbNA: 30,
  bz: -6,
  isLoading: false,
  alertsEnabled: true,
  alertSensitivity: 'balanced' as const,
  notificationPermission: 'granted' as NotificationPermission,
};

describe('useAutoAlert', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-07T01:00:00Z'));
    vi.stubGlobal('Notification', mockNotification);
    mockNotification.mockClear();
    vi.mocked(loadLastNotified).mockReturnValue(0);
    vi.mocked(saveLastNotified).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('fires notification when permission is granted and threshold is met', () => {
    renderHook(() => useAutoAlert(GRANTED_PARAMS));

    expect(mockNotification).toHaveBeenCalledOnce();
    expect(mockNotification).toHaveBeenCalledWith(
      'AuroraWatch Alert',
      expect.objectContaining({ body: expect.stringContaining('5.0'), tag: 'aurorawatch-mi' })
    );
    expect(vi.mocked(saveLastNotified)).toHaveBeenCalledOnce();
  });

  it('does not fire when permission is not granted', () => {
    renderHook(() => useAutoAlert({ ...GRANTED_PARAMS, notificationPermission: 'denied' }));
    expect(mockNotification).not.toHaveBeenCalled();
  });

  it('does not fire when isLoading is true', () => {
    renderHook(() => useAutoAlert({ ...GRANTED_PARAMS, isLoading: true }));
    expect(mockNotification).not.toHaveBeenCalled();
  });

  it('does not fire when alertsEnabled is false', () => {
    renderHook(() => useAutoAlert({ ...GRANTED_PARAMS, alertsEnabled: false }));
    expect(mockNotification).not.toHaveBeenCalled();
  });

  it('does not fire when kp is null', () => {
    renderHook(() => useAutoAlert({ ...GRANTED_PARAMS, kp: null }));
    expect(mockNotification).not.toHaveBeenCalled();
  });

  it('does not fire when kp is below the balanced threshold (kp < 4)', () => {
    renderHook(() => useAutoAlert({ ...GRANTED_PARAMS, kp: 3 }));
    expect(mockNotification).not.toHaveBeenCalled();
  });

  it('respects 30-min throttle: no notification within 30 minutes of last alert', () => {
    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    vi.mocked(loadLastNotified).mockReturnValue(tenMinAgo);

    renderHook(() => useAutoAlert(GRANTED_PARAMS));

    expect(mockNotification).not.toHaveBeenCalled();
  });

  it('fires again after 30-min throttle has expired', () => {
    const thirtyOneMinAgo = Date.now() - 31 * 60 * 1000;
    vi.mocked(loadLastNotified).mockReturnValue(thirtyOneMinAgo);

    renderHook(() => useAutoAlert(GRANTED_PARAMS));

    expect(mockNotification).toHaveBeenCalledOnce();
  });

  it('surge (Kp jump ≥ 2): fires "jumped" notification body', () => {
    // First render: kp=3 (below balanced threshold, no notification)
    const { rerender } = renderHook((props) => useAutoAlert(props), {
      initialProps: { ...GRANTED_PARAMS, kp: 3 },
    });
    expect(mockNotification).not.toHaveBeenCalled();

    // Kp jumps to 5 — surge of 2, qualifies for 5-min throttle window
    act(() => { rerender({ ...GRANTED_PARAMS, kp: 5 }); });

    expect(mockNotification).toHaveBeenCalledOnce();
    const body = mockNotification.mock.calls[0][1].body as string;
    expect(body).toContain('jumped');
    expect(body).toContain('5.0');
    expect(body).toContain('3.0');
  });

  it('surge fires within 30-min window because its throttle is only 5 min', () => {
    // lastNotified was 6 minutes ago — still within 30-min normal throttle
    const sixMinAgo = Date.now() - 6 * 60 * 1000;
    vi.mocked(loadLastNotified).mockReturnValue(sixMinAgo);

    // First render sets prevKp=3
    const { rerender } = renderHook((props) => useAutoAlert(props), {
      initialProps: { ...GRANTED_PARAMS, kp: 3 },
    });
    mockNotification.mockClear();

    // Kp jumps to 5 — surge throttle is 5 min, last notified 6 min ago → fires
    act(() => { rerender({ ...GRANTED_PARAMS, kp: 5 }); });

    expect(mockNotification).toHaveBeenCalledOnce();
  });

  it('non-surge does NOT fire within 30-min normal throttle', () => {
    const sixMinAgo = Date.now() - 6 * 60 * 1000;
    vi.mocked(loadLastNotified).mockReturnValue(sixMinAgo);

    // kp starts at 5 (no previous value → no surge)
    renderHook(() => useAutoAlert(GRANTED_PARAMS));

    // 6 min < 30 min throttle → blocked
    expect(mockNotification).not.toHaveBeenCalled();
  });
});
