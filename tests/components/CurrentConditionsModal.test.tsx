import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CurrentConditionsModal } from '../../components/solar/CurrentConditionsModal';

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

const defaultProps = {
  kp: 4.5,
  bz: -6.2,
  solarWindSpeed: 550,
  maxAuroraProbNA: 35,
  ovationProcessed: true,
  onClose: vi.fn(),
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockUseUserLocationContext.mockReturnValue(noLocation);
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CurrentConditionsModal', () => {
  it('renders with role="dialog"', () => {
    render(<CurrentConditionsModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('derives its accessible name from the heading via aria-labelledby', () => {
    render(<CurrentConditionsModal {...defaultProps} />);
    // aria-labelledby points to the heading span; accessible name = heading text content
    expect(screen.getByRole('dialog', { name: /live conditions/i })).toBeInTheDocument();
  });

  it('renders all four metric section headings', () => {
    render(<CurrentConditionsModal {...defaultProps} />);
    expect(screen.getByText('Solar Wind')).toBeInTheDocument();
    expect(screen.getByText('IMF Bz')).toBeInTheDocument();
    expect(screen.getByText(/Planetary Kp/)).toBeInTheDocument();
    expect(screen.getByText('NOAA OVATION Model')).toBeInTheDocument();
  });

  it('renders dynamic status text derived from live values', () => {
    render(<CurrentConditionsModal {...defaultProps} />);
    // Exact status strings match only the status <div> — parent containers have longer text
    expect(screen.getByText('550 km/s — elevated')).toBeInTheDocument();
    expect(screen.getByText('-6.2 nT — southward')).toBeInTheDocument();
    expect(screen.getByText('Kp 4.5 — enhanced')).toBeInTheDocument();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<CurrentConditionsModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose when inner panel content is clicked', () => {
    const onClose = vi.fn();
    render(<CurrentConditionsModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('Solar Wind'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when the top close (X) button is clicked', () => {
    const onClose = vi.fn();
    render(<CurrentConditionsModal {...defaultProps} onClose={onClose} />);
    // Two close buttons now exist; first in DOM order is the X in the header
    fireEvent.click(screen.getAllByRole('button', { name: /close/i })[0]);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the bottom close button is clicked', () => {
    const onClose = vi.fn();
    render(<CurrentConditionsModal {...defaultProps} onClose={onClose} />);
    // Bottom button has visible text "Close"; X button renders only an SVG
    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not render the location box when userLocationProb is null', () => {
    mockUseUserLocationContext.mockReturnValue(withLocation);
    render(<CurrentConditionsModal {...defaultProps} userLocationProb={null} />);
    expect(screen.queryByText(/Grand Rapids/)).not.toBeInTheDocument();
  });

  it('renders the location box when userLocationProb is provided', () => {
    mockUseUserLocationContext.mockReturnValue(withLocation);
    render(<CurrentConditionsModal {...defaultProps} userLocationProb={22} />);
    expect(screen.getByText(/Grand Rapids/)).toBeInTheDocument();
  });

  it('location box appears before general content when location is set', () => {
    mockUseUserLocationContext.mockReturnValue(withLocation);
    render(<CurrentConditionsModal {...defaultProps} userLocationProb={22} />);
    const text = screen.getByRole('dialog').textContent ?? '';
    expect(text.indexOf('Grand Rapids')).toBeLessThan(text.indexOf('Live now vs'));
  });

  it('first sentence in location box is bold', () => {
    mockUseUserLocationContext.mockReturnValue(withLocation);
    render(<CurrentConditionsModal {...defaultProps} userLocationProb={22} />);
    // selector: 'span' avoids matching the containing <p> which also has this text
    const boldEl = screen.getByText(/Grand Rapids, MI is showing 22%/, { selector: 'span' });
    expect(boldEl).toHaveClass('font-semibold');
  });

  it('rest of location box text is at regular weight', () => {
    mockUseUserLocationContext.mockReturnValue(withLocation);
    render(<CurrentConditionsModal {...defaultProps} userLocationProb={22} />);
    const restEl = screen.getByText(/Dark skies and patience/, { selector: 'span' });
    expect(restEl).not.toHaveClass('font-semibold');
  });
});
