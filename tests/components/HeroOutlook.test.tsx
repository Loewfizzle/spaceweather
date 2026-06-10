import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { HeroOutlook } from '../../components/HeroOutlook';
import type { UserLocationContextValue } from '../../lib/context/UserLocationContext';
import type { TonightOutlook } from '../../lib/aurora/outlook';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockUseUserLocationContext = vi.fn();

vi.mock('../../lib/context/UserLocationContext', () => ({
  useUserLocationContext: () => mockUseUserLocationContext(),
}));

vi.mock('../../components/ShareButton',              () => ({ ShareButton:              () => null }));
vi.mock('../../components/NotificationPrompt',       () => ({ NotificationPrompt:       () => null }));
vi.mock('../../components/InstallPrompt',            () => ({ InstallPrompt:            () => null }));
vi.mock('../../components/LocationPicker', () => ({
  LocationPicker: ({ onConfirm, onCancel }: { onConfirm: (lat: number, lon: number, label: string) => void; onCancel: () => void }) => (
    <div data-testid="location-picker">
      <button onClick={() => onConfirm(45.0, -93.0, 'Minneapolis, MN')}>Confirm location</button>
      <button onClick={onCancel}>Cancel picker</button>
    </div>
  ),
}));
vi.mock('../../components/solar/CurrentConditionsModal', () => ({
  CurrentConditionsModal: () => <div data-testid="conditions-modal" />,
}));

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

  it('renders the status label when data is present', () => {
    render(<HeroOutlook outlook={goodOutlook} />);
    expect(screen.getByText('Good')).toBeInTheDocument();
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
  });

  it('opens CurrentConditionsModal when the Details button is clicked', () => {
    render(<HeroOutlook outlook={goodOutlook} />);
    expect(screen.queryByTestId('conditions-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /details/i }));
    expect(screen.getByTestId('conditions-modal')).toBeInTheDocument();
  });

  it('shows location label and Clear button when locationSource is "gps"', () => {
    mockUseUserLocationContext.mockReturnValue({
      ...defaultContext,
      locationSource: 'gps',
      userLocationLabel: 'Anchorage, AK',
    });
    render(<HeroOutlook outlook={goodOutlook} />);
    expect(screen.getByText('Anchorage, AK')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear saved location/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /change/i })).not.toBeInTheDocument();
  });

  it('shows location label and Clear button when locationSource is "manual"', () => {
    mockUseUserLocationContext.mockReturnValue({
      ...defaultContext,
      locationSource: 'manual',
      userLocationLabel: 'Denver, CO',
    });
    render(<HeroOutlook outlook={goodOutlook} />);
    expect(screen.getByText('Denver, CO')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear saved location/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /change/i })).not.toBeInTheDocument();
  });

  it('displays "< 1%" when userLocationProb is 0', () => {
    render(<HeroOutlook outlook={goodOutlook} userLocationProb={0} />);
    expect(screen.getByText('< 1%')).toBeInTheDocument();
  });

  it('displays the numeric percentage when userLocationProb is > 0', () => {
    render(<HeroOutlook outlook={goodOutlook} userLocationProb={42} />);
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('shows "locationTimedOut" retry text on the GPS button', () => {
    mockUseUserLocationContext.mockReturnValue({
      ...defaultContext,
      onRequestLocation: vi.fn(),
      locationTimedOut: true,
    });
    render(<HeroOutlook outlook={goodOutlook} />);
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('shows "Locating…" text while location is being fetched', () => {
    mockUseUserLocationContext.mockReturnValue({
      ...defaultContext,
      onRequestLocation: vi.fn(),
      isLocating: true,
    });
    render(<HeroOutlook outlook={goodOutlook} />);
    expect(screen.getByText('Locating…')).toBeInTheDocument();
  });

  it('shows "Enter manually" when onRequestLocation is provided (line 234 true branch)', () => {
    mockUseUserLocationContext.mockReturnValue({
      ...defaultContext,
      onRequestLocation: vi.fn(),
    });
    render(<HeroOutlook outlook={goodOutlook} />);
    expect(screen.getByText('Enter manually')).toBeInTheDocument();
  });

  it('shows "Set location" when onRequestLocation is absent (line 234 false branch)', () => {
    render(<HeroOutlook outlook={goodOutlook} />);
    expect(screen.getByText('Set location')).toBeInTheDocument();
    expect(screen.queryByText('Enter manually')).not.toBeInTheDocument();
  });

  it('clicking "Set location" shows the LocationPicker', () => {
    const setManualLocation = vi.fn();
    mockUseUserLocationContext.mockReturnValue({
      ...defaultContext,
      setManualLocation,
    });
    render(<HeroOutlook outlook={goodOutlook} />);
    expect(screen.queryByTestId('location-picker')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Set location'));
    expect(screen.getByTestId('location-picker')).toBeInTheDocument();
  });

  it('confirming a location calls setManualLocation and hides the picker (lines 265–271)', () => {
    const setManualLocation = vi.fn();
    mockUseUserLocationContext.mockReturnValue({
      ...defaultContext,
      setManualLocation,
    });
    render(<HeroOutlook outlook={goodOutlook} />);
    fireEvent.click(screen.getByText('Set location'));
    fireEvent.click(screen.getByText('Confirm location'));
    expect(setManualLocation).toHaveBeenCalledWith(45.0, -93.0, 'Minneapolis, MN');
    expect(screen.queryByTestId('location-picker')).not.toBeInTheDocument();
  });

  it('cancelling the picker hides it without calling setManualLocation', () => {
    const setManualLocation = vi.fn();
    mockUseUserLocationContext.mockReturnValue({
      ...defaultContext,
      setManualLocation,
    });
    render(<HeroOutlook outlook={goodOutlook} />);
    fireEvent.click(screen.getByText('Set location'));
    fireEvent.click(screen.getByText('Cancel picker'));
    expect(setManualLocation).not.toHaveBeenCalled();
    expect(screen.queryByTestId('location-picker')).not.toBeInTheDocument();
  });
});
