import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ViewingWindow } from '../../components/ViewingWindow';
import type { ViewingWindowData } from '../../lib/utils/viewingWindow';

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

  it('does not render last-night section when kpHistory is empty', () => {
    render(<ViewingWindow {...defaultProps} kpHistory={[]} />);
    expect(screen.queryByText(/Last night/i)).not.toBeInTheDocument();
  });
});
