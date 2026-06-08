import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { KpForecast } from '../../components/KpForecast';
import type { KpEntry, KpForecastEntry } from '../../lib/api/schemas';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="kp-chart" />,
}));

// Prevent chart.js from attempting canvas operations in jsdom
vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  CategoryScale: class {},
  LinearScale: class {},
  PointElement: class {},
  LineElement: class {},
  Title: class {},
  Tooltip: class {},
  Legend: class {},
}));

const mockUseChartData = vi.fn();
vi.mock('../../lib/hooks/useChartData', () => ({
  useChartData: (...args: unknown[]) => mockUseChartData(...args),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const defaultChartData = {
  chartData:    { datasets: [] },
  chartOptions: {},
  chartPlugins: [],
  hasTonight:   false,
  hasForecast:  true,
};

const kpHistory: KpEntry[] = [
  { time_tag: '2026-06-06T00:00:00Z', Kp: 2 },
  { time_tag: '2026-06-06T03:00:00Z', Kp: 2.5 },
  { time_tag: '2026-06-06T06:00:00Z', Kp: 3 },
  { time_tag: '2026-06-06T09:00:00Z', Kp: 3.5 },
  { time_tag: '2026-06-06T12:00:00Z', Kp: 4 },
  { time_tag: '2026-06-06T15:00:00Z', Kp: 5 },
];

// Future timestamps so useStormDays includes them
const futureBase = Date.now() + 1000 * 60 * 60 * 24;
const kpForecastData: KpForecastEntry[] = [
  { time_tag: new Date(futureBase).toISOString(),                     kp: 5 },
  { time_tag: new Date(futureBase + 1000 * 60 * 60 * 24).toISOString(), kp: 3 },
  { time_tag: new Date(futureBase + 1000 * 60 * 60 * 48).toISOString(), kp: 2 },
];

const defaultProps = {
  guidance:          'Good chance across northern-tier states.',
  kpHistory,
  kpForecastData,
  kpIsLoading:       false,
  kpError:           null,
  forecastIsLoading: false,
  forecastError:     null,
  onRefetchKp:       vi.fn(),
  onRefetchForecast: vi.fn(),
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockUseChartData.mockReturnValue(defaultChartData);
  vi.clearAllMocks();
  mockUseChartData.mockReturnValue(defaultChartData);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('KpForecast', () => {
  it('renders the loading skeleton when kpIsLoading is true', () => {
    render(<KpForecast {...defaultProps} kpIsLoading={true} />);
    // Chart should not be present; skeleton div rendered instead
    expect(screen.queryByTestId('kp-chart')).not.toBeInTheDocument();
  });

  it('renders the chart when kpHistory has entries', () => {
    render(<KpForecast {...defaultProps} />);
    expect(screen.getByTestId('kp-chart')).toBeInTheDocument();
  });

  it('renders the guidance text in the outlook section', () => {
    render(<KpForecast {...defaultProps} />);
    expect(screen.getByText(/Good chance across northern-tier states/i)).toBeInTheDocument();
  });

  it('renders the rising trend label when recent Kp average exceeds prior average', () => {
    // kpHistory above: last 3 avg = (3.5+4+5)/3 ≈ 4.17, prior 3 avg = (2+2.5+3)/3 ≈ 2.5 → Rising
    render(<KpForecast {...defaultProps} />);
    expect(screen.getByText(/Rising/i)).toBeInTheDocument();
  });

  it('renders the stable/declining trend when recent average is not higher', () => {
    const decliningHistory: KpEntry[] = [
      { time_tag: '2026-06-06T00:00:00Z', Kp: 5 },
      { time_tag: '2026-06-06T03:00:00Z', Kp: 4.5 },
      { time_tag: '2026-06-06T06:00:00Z', Kp: 4 },
      { time_tag: '2026-06-06T09:00:00Z', Kp: 3 },
      { time_tag: '2026-06-06T12:00:00Z', Kp: 2.5 },
      { time_tag: '2026-06-06T15:00:00Z', Kp: 2 },
    ];
    render(<KpForecast {...defaultProps} kpHistory={decliningHistory} />);
    expect(screen.getByText(/Stable or declining/i)).toBeInTheDocument();
  });

  it('renders storm outlook cards when kpForecastData has future entries', () => {
    render(<KpForecast {...defaultProps} />);
    expect(screen.getByText('3-DAY STORM OUTLOOK')).toBeInTheDocument();
    // Each card shows a Kp badge label
    expect(screen.getByText('G1')).toBeInTheDocument();
  });

  it('shows the forecast error message when forecastError is set and hasForecast is false', () => {
    mockUseChartData.mockReturnValue({ ...defaultChartData, hasForecast: false });
    render(
      <KpForecast
        {...defaultProps}
        forecastError={new Error('Forecast down')}
        kpForecastData={[]}
      />
    );
    // Text appears in both the note line and the storm section error block
    const matches = screen.getAllByText(/Forecast temporarily unavailable/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onRefetchKp when the retry button is clicked on kp error state', () => {
    const onRefetchKp = vi.fn();
    render(
      <KpForecast
        {...defaultProps}
        kpError={new Error('Kp down')}
        kpHistory={[]}
        kpForecastData={[]}
        onRefetchKp={onRefetchKp}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRefetchKp).toHaveBeenCalledOnce();
  });

  it('shows "No recent Kp data" when kpHistory is empty and there is no error (line 126)', () => {
    render(
      <KpForecast
        {...defaultProps}
        kpHistory={[]}
        kpIsLoading={false}
        kpError={null}
      />
    );
    expect(screen.getByText('No recent Kp data')).toBeInTheDocument();
    expect(screen.queryByTestId('kp-chart')).not.toBeInTheDocument();
  });

  it('renders the forecast loading skeleton (lines 158, 165–171) when forecastIsLoading is true', () => {
    render(
      <KpForecast
        {...defaultProps}
        forecastIsLoading={true}
        kpForecastData={[]}
      />
    );
    // The 3-day storm section renders — check its skeleton heading pulse div is present
    // and the "3-DAY STORM OUTLOOK" text is NOT yet shown (replaced by pulse div)
    expect(screen.queryByText('3-DAY STORM OUTLOOK')).not.toBeInTheDocument();
    // Three skeleton cards are rendered (one per forecast day slot)
    const { container } = render(
      <KpForecast
        {...defaultProps}
        forecastIsLoading={true}
        kpForecastData={[]}
      />
    );
    // The storm section wrapper is present (contains animate-pulse divs)
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('shows "Based on current solar wind" trend text when kpHistory has fewer than 4 entries', () => {
    render(
      <KpForecast
        {...defaultProps}
        kpHistory={kpHistory.slice(0, 2)}
      />
    );
    expect(screen.getByText(/Based on current solar wind/i)).toBeInTheDocument();
  });

  it('shows tonight shading note when hasTonight is true (line 144)', () => {
    mockUseChartData.mockReturnValue({ ...defaultChartData, hasTonight: true });
    render(<KpForecast {...defaultProps} />);
    expect(screen.getByText(/shaded = tonight/i)).toBeInTheDocument();
  });

  it('useStormDays skips entries with no time_tag and past timestamps (lines 66–75)', () => {
    const mixedForecast: KpForecastEntry[] = [
      { time_tag: null,  kp: 9 },  // no time_tag → continue (line 67)
      { time_tag: new Date(Date.now() - 1000 * 60 * 60).toISOString(), kp: 8 }, // past → continue
      { time_tag: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), kp: 5 }, // future → counted
    ];
    render(<KpForecast {...defaultProps} kpForecastData={mixedForecast} />);
    // Only future entry with kp=5 should appear → "G1" badge
    expect(screen.getByText('G1')).toBeInTheDocument();
    // High kp entries with null/past time_tag should NOT inflate the badge
    expect(screen.queryByText('G3+')).not.toBeInTheDocument();
  });

  it('uses ?? 0 fallback for null Kp values in trend calculation (line 96)', () => {
    const historyWithNull: KpEntry[] = [
      { time_tag: '2026-06-06T00:00:00Z', Kp: null },
      { time_tag: '2026-06-06T03:00:00Z', Kp: null },
      { time_tag: '2026-06-06T06:00:00Z', Kp: null },
      { time_tag: '2026-06-06T09:00:00Z', Kp: 1 },
      { time_tag: '2026-06-06T12:00:00Z', Kp: 1 },
      { time_tag: '2026-06-06T15:00:00Z', Kp: 1 },
    ];
    render(<KpForecast {...defaultProps} kpHistory={historyWithNull} />);
    // recent avg (1+1+1)/3=1 vs prior avg (0+0+0)/3=0 → recent > prior → Rising
    expect(screen.getByText(/Rising/i)).toBeInTheDocument();
  });
});
