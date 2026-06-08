import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ViewingWindow } from '../../components/ViewingWindow';
import { computeLastNightPeak } from '../../lib/utils/viewingWindow';
import type { ViewingWindowData } from '../../lib/utils/viewingWindow';

// ── Module mocks ──────────────────────────────────────────────────────────────

// Make computeLastNightPeak controllable so tests don't depend on the clock.
// All other exports (computeViewingWindow, etc.) pass through unchanged.
vi.mock('../../lib/utils/viewingWindow', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/utils/viewingWindow')>();
  return { ...actual, computeLastNightPeak: vi.fn().mockReturnValue(null) };
});

// Stub the modal so opening it doesn't require full ViewingWindowModal internals.
vi.mock('../../components/solar/ViewingWindowModal', () => ({
  ViewingWindowModal: () => <div data-testid="viewing-window-modal" />,
}));

vi.mock('../../lib/context/UserLocationContext', () => ({
  useUserLocationContext: () => ({
    userLat: null,
    userLon: null,
    userLocationLabel: null,
    state: { status: 'idle' },
    requestGpsLocation: vi.fn(),
    setManualLocation: vi.fn(),
    clearLocation: vi.fn(),
    locationSource: null,
    isLocating: false,
    locationTimedOut: false,
    onRequestLocation: undefined,
  }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const activeWindow: ViewingWindowData = {
  hasData: true,
  peakKp: 6.0,
  windowStart: new Date('2026-06-07T01:00:00Z'),
  windowEnd: new Date('2026-06-07T10:00:00Z'),
  allBlocks: [],
};

const emptyWindow: ViewingWindowData = {
  hasData: false,
  peakKp: 0,
  windowStart: null,
  windowEnd: null,
  allBlocks: [],
};

const defaultProps = {
  kpForecast: [],
  kpHistory: [],
  viewingWindow: activeWindow,
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(computeLastNightPeak).mockReturnValue(null);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ViewingWindow', () => {
  it('renders loading skeleton when isLoading and no window data', () => {
    render(
      <ViewingWindow
        {...defaultProps}
        viewingWindow={emptyWindow}
        isLoading={true}
      />
    );
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it("renders 'no forecast data' message when no window data and not loading", () => {
    render(
      <ViewingWindow
        {...defaultProps}
        viewingWindow={emptyWindow}
        isLoading={false}
      />
    );
    expect(screen.getByText(/No forecast data available/i)).toBeInTheDocument();
  });

  it("renders TONIGHT'S FORECAST heading and peak Kp value when window has data", () => {
    render(<ViewingWindow {...defaultProps} />);
    expect(screen.getByText("TONIGHT'S FORECAST")).toBeInTheDocument();
    expect(screen.getByText('6.0')).toBeInTheDocument();
  });

  it('shows cloud cover label when locationGranted is true and cloudCoverPct is provided', () => {
    render(
      <ViewingWindow
        {...defaultProps}
        cloudCoverPct={35}
        cloudCoverLabel="Partly cloudy"
        locationGranted={true}
      />
    );
    expect(screen.getByText(/Your skies tonight:/i)).toBeInTheDocument();
    expect(screen.getByText(/Partly cloudy/)).toBeInTheDocument();
  });

  it('shows share-location nudge when locationGranted is false', () => {
    render(<ViewingWindow {...defaultProps} locationGranted={false} />);
    expect(screen.getByText(/Share location for personalised sky conditions/i)).toBeInTheDocument();
  });

  it('renders last-night fallback when kpHistory is empty and not loading', () => {
    render(<ViewingWindow {...defaultProps} kpHistory={[]} isLoading={false} />);
    expect(screen.getByText(/Last night: no data available/i)).toBeInTheDocument();
  });

  it('does not render last-night section when isLoading is true', () => {
    render(<ViewingWindow {...defaultProps} kpHistory={[]} isLoading={true} />);
    // isLoading skips the early-return path here because viewingWindow has data;
    // the last-night fallback should be suppressed while data is still loading
    expect(screen.queryByText(/Last night/i)).not.toBeInTheDocument();
  });

  it('renders the last-night section when computeLastNightPeak returns data', () => {
    vi.mocked(computeLastNightPeak).mockReturnValueOnce({
      peakKp: 4.5,
      peakTime: new Date('2026-06-06T04:00:00Z'),
    });
    render(<ViewingWindow {...defaultProps} />);
    expect(screen.getByText(/Last night/i)).toBeInTheDocument();
    // The Kp value is rendered as "Kp 4.5" inside a single span
    expect(screen.getByText(/Kp 4\.5/)).toBeInTheDocument();
  });

  it('renders only the last-night row (no tonight block) when hasData is false but lastNight is present', () => {
    vi.mocked(computeLastNightPeak).mockReturnValueOnce({
      peakKp: 3.0,
      peakTime: new Date('2026-06-06T03:00:00Z'),
    });
    render(<ViewingWindow {...defaultProps} viewingWindow={emptyWindow} />);
    // The empty+lastNight path skips the early return — lastNight shows, no tonight block
    expect(screen.queryByText(/No forecast data/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Last night/i)).toBeInTheDocument();
    expect(screen.queryByText('Forecast peak')).not.toBeInTheDocument();
  });

  it('opens the ViewingWindowModal when the Details button is clicked', () => {
    render(<ViewingWindow {...defaultProps} />);
    expect(screen.queryByTestId('viewing-window-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /details/i }));
    expect(screen.getByTestId('viewing-window-modal')).toBeInTheDocument();
  });

  it('does not render a time range when windowStart and windowEnd are null', () => {
    const noTimeWindow: ViewingWindowData = {
      hasData: true,
      peakKp: 5.0,
      windowStart: null,
      windowEnd: null,
      allBlocks: [],
    };
    render(<ViewingWindow {...defaultProps} viewingWindow={noTimeWindow} />);
    expect(screen.queryByText('ET')).not.toBeInTheDocument();
  });

  it('shows storm guidance text for a very high peakKp', () => {
    const stormWindow: ViewingWindowData = { ...activeWindow, peakKp: 8.0 };
    render(<ViewingWindow {...defaultProps} viewingWindow={stormWindow} />);
    expect(screen.getByText(/Strong aurora forecast/i)).toBeInTheDocument();
  });

  it('shows quiet guidance text for a low peakKp', () => {
    const quietWindow: ViewingWindowData = { ...activeWindow, peakKp: 1.5 };
    render(<ViewingWindow {...defaultProps} viewingWindow={quietWindow} />);
    expect(screen.getByText(/Quiet conditions forecast/i)).toBeInTheDocument();
  });
});
