import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AuroraMapModal } from '../../components/solar/AuroraMapModal';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockUseUserLocationContext = vi.fn();

vi.mock('../../lib/context/UserLocationContext', () => ({
  useUserLocationContext: () => mockUseUserLocationContext(),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const noLocation = {
  state: { status: 'idle' as const },
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

const withLocation = {
  ...noLocation,
  userLat: 44.0,
  userLon: -85.0,
  userLocationLabel: 'Grand Rapids, MI',
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockUseUserLocationContext.mockReturnValue(noLocation);
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuroraMapModal', () => {
  it('renders with role="dialog"', () => {
    render(<AuroraMapModal onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders the Aurora Map header', () => {
    render(<AuroraMapModal onClose={vi.fn()} />);
    expect(screen.getByText('Aurora Map')).toBeInTheDocument();
  });

  it('renders core informational sections', () => {
    render(<AuroraMapModal onClose={vi.fn()} />);
    expect(screen.getByText('What this map is showing')).toBeInTheDocument();
    expect(screen.getByText('What the colors mean')).toBeInTheDocument();
    expect(screen.getByText(/What the percentages actually mean/)).toBeInTheDocument();
    expect(screen.getByText('How the filter slider works')).toBeInTheDocument();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<AuroraMapModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose when inner panel content is clicked', () => {
    const onClose = vi.fn();
    render(<AuroraMapModal onClose={onClose} />);
    fireEvent.click(screen.getByText('What this map is showing'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<AuroraMapModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not render the location box when context has no location', () => {
    render(<AuroraMapModal onClose={vi.fn()} userProb={25} />);
    expect(screen.queryByText(/Grand Rapids/)).not.toBeInTheDocument();
  });

  it('does not render the location box when userProb is not provided', () => {
    mockUseUserLocationContext.mockReturnValue(withLocation);
    render(<AuroraMapModal onClose={vi.fn()} />);
    // hasLocation requires userProb !== undefined
    expect(screen.queryByText(/Grand Rapids/)).not.toBeInTheDocument();
  });

  it('renders the location box when context has location and userProb is provided', () => {
    mockUseUserLocationContext.mockReturnValue(withLocation);
    render(<AuroraMapModal onClose={vi.fn()} userProb={25} />);
    expect(screen.getByText(/Grand Rapids/)).toBeInTheDocument();
  });

  it('location box appears before general content when location is set', () => {
    mockUseUserLocationContext.mockReturnValue(withLocation);
    render(<AuroraMapModal onClose={vi.fn()} userProb={25} />);
    const text = screen.getByRole('dialog').textContent ?? '';
    expect(text.indexOf('Grand Rapids')).toBeLessThan(text.indexOf('What this map is showing'));
  });

  it('first sentence in location box is bold', () => {
    mockUseUserLocationContext.mockReturnValue(withLocation);
    render(<AuroraMapModal onClose={vi.fn()} userProb={25} />);
    // prob=25: "Grand Rapids, MI is showing 25% — a meaningful reading."
    const boldEl = screen.getByText(/Grand Rapids, MI is showing 25%/, { selector: 'span' });
    expect(boldEl).toHaveClass('font-semibold');
  });

  it('rest of location text is at regular weight', () => {
    mockUseUserLocationContext.mockReturnValue(withLocation);
    render(<AuroraMapModal onClose={vi.fn()} userProb={25} />);
    const restEl = screen.getByText(/There is aurora above your area/, { selector: 'span' });
    expect(restEl).not.toHaveClass('font-semibold');
  });
});
