import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { HeroOutlook } from '../../components/HeroOutlook';
import type { UserLocationContextValue } from '../../lib/context/UserLocationContext';
import type { TonightOutlook } from '../../lib/aurora/outlook';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockUseUserLocationContext = vi.fn();

vi.mock('../../lib/context/UserLocationContext', () => ({
  useUserLocationContext: () => mockUseUserLocationContext(),
}));

vi.mock('../../components/ShareButton',         () => ({ ShareButton:         () => null }));
vi.mock('../../components/NotificationPrompt',  () => ({ NotificationPrompt:  () => null }));
vi.mock('../../components/InstallPrompt',       () => ({ InstallPrompt:       () => null }));
vi.mock('../../components/LocationPicker',      () => ({ LocationPicker:      () => null }));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const defaultContext: UserLocationContextValue = {
  state: { status: 'idle' },
  requestGpsLocation: vi.fn(),
  setManualLocation: vi.fn(),
  clearLocation: vi.fn(),
  userLat: null,
  userLon: null,
  userLocationLabel: null,
  locationSource: null,
  isLocating: false,
  locationTimedOut: false,
  onRequestLocation: undefined,
};

const loadingOutlook: TonightOutlook = {
  status: 'Loading',
  message: 'Loading current conditions…',
  reasons: [],
  accentColor: '#64748b',
};

const goodOutlook: TonightOutlook = {
  status: 'Good',
  message: 'Good chance tonight for northern-tier states.',
  reasons: ['Southward Bz currently favorable'],
  accentColor: '#f97316',
  drivers: 'Kp 5.0 • Bz -8.0 nT • 550 km/s',
  cityProbs: [
    { name: 'Fairbanks', state: 'AK', prob: 80 },
    { name: 'Seattle',   state: 'WA', prob: 45 },
  ],
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockUseUserLocationContext.mockReturnValue(defaultContext);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('HeroOutlook', () => {
  it('renders the loading skeleton when status is Loading', () => {
    render(<HeroOutlook outlook={loadingOutlook} />);
    // Status label should NOT be present while loading
    expect(screen.queryByText(/Current indicators show/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/very low/)).not.toBeInTheDocument();
  });

  it('renders the status sentence when data is present', () => {
    render(<HeroOutlook outlook={goodOutlook} />);
    expect(screen.getByText(/Current indicators show good chance/i)).toBeInTheDocument();
  });

  it('renders the drivers string when provided', () => {
    render(<HeroOutlook outlook={goodOutlook} />);
    expect(screen.getByText('Kp 5.0 • Bz -8.0 nT • 550 km/s')).toBeInTheDocument();
  });

  it('renders city probability rows when outlook.cityProbs is populated', () => {
    render(<HeroOutlook outlook={goodOutlook} />);
    expect(screen.getByText('Fairbanks, AK')).toBeInTheDocument();
    expect(screen.getByText('Seattle, WA')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('renders the error message when error is set and kp is non-null', () => {
    render(
      <HeroOutlook
        outlook={goodOutlook}
        error={new Error('Network error')}
        kp={5}
      />
    );
    expect(
      screen.getByText(/NOAA temporarily unreachable — showing last known values/i)
    ).toBeInTheDocument();
  });

  it('renders the "no data" error message when error is set and kp is null', () => {
    render(
      <HeroOutlook
        outlook={goodOutlook}
        error={new Error('Network error')}
        kp={null}
      />
    );
    expect(
      screen.getByText(/data will appear when connection is restored/i)
    ).toBeInTheDocument();
  });

  it('shows "Use my location" button when onRequestLocation is provided by context', () => {
    mockUseUserLocationContext.mockReturnValue({
      ...defaultContext,
      onRequestLocation: vi.fn(),
    });
    render(<HeroOutlook outlook={goodOutlook} />);
    expect(screen.getByText('Use my location')).toBeInTheDocument();
  });

  it('shows cloud cover label when cloudCoverPct is provided', () => {
    render(
      <HeroOutlook
        outlook={goodOutlook}
        cloudCoverPct={42}
        cloudCoverLabel="Partly cloudy"
      />
    );
    expect(screen.getByText('Your skies tonight:')).toBeInTheDocument();
    expect(screen.getByText(/Partly cloudy/)).toBeInTheDocument();
    expect(screen.getByText('· 8pm–6am avg')).toBeInTheDocument();
  });
});
