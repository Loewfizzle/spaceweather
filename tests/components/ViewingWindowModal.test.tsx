import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ViewingWindowModal } from '../../components/solar/ViewingWindowModal';

// ViewingWindowModal receives userLat/userLocationLabel as props (no context call).

// ── Fixtures ──────────────────────────────────────────────────────────────────

const defaultProps = {
  kp: 4.0,
  peakKp: 4.0,
  onClose: vi.fn(),
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ViewingWindowModal', () => {
  it('renders with role="dialog"', () => {
    render(<ViewingWindowModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it("renders the Tonight's Forecast header", () => {
    render(<ViewingWindowModal {...defaultProps} />);
    expect(screen.getByText("Tonight's Forecast")).toBeInTheDocument();
  });

  it('renders Kp section heading with the effective Kp value', () => {
    render(<ViewingWindowModal {...defaultProps} />);
    expect(screen.getByText('What Kp 4.0 means')).toBeInTheDocument();
  });

  it('uses peakKp when kp is null', () => {
    render(<ViewingWindowModal kp={null} peakKp={6.0} onClose={vi.fn()} />);
    expect(screen.getByText('What Kp 6.0 means')).toBeInTheDocument();
  });

  it('renders the "What affects what you see" section', () => {
    render(<ViewingWindowModal {...defaultProps} />);
    expect(screen.getByText('What affects what you see')).toBeInTheDocument();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<ViewingWindowModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose when inner panel content is clicked', () => {
    const onClose = vi.fn();
    render(<ViewingWindowModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('About this forecast'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<ViewingWindowModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not render the location box when userLat is null', () => {
    render(<ViewingWindowModal {...defaultProps} userLat={null} />);
    // no location-specific text should appear
    expect(screen.queryByText(/well south of the aurora oval/)).not.toBeInTheDocument();
  });

  it('renders the location box when userLat is provided', () => {
    render(<ViewingWindowModal {...defaultProps} userLat={44.0} userLocationLabel="Grand Rapids, MI" />);
    expect(screen.getByText(/Grand Rapids/)).toBeInTheDocument();
  });

  it('location box appears before general content when location is set', () => {
    render(<ViewingWindowModal {...defaultProps} userLat={44.0} userLocationLabel="Grand Rapids, MI" />);
    const text = screen.getByRole('dialog').textContent ?? '';
    expect(text.indexOf('Grand Rapids')).toBeLessThan(text.indexOf('About this forecast'));
  });

  it('first sentence in location box is bold', () => {
    render(<ViewingWindowModal {...defaultProps} userLat={44.0} userLocationLabel="Grand Rapids, MI" />);
    // kp=4 → minLat=55 → diff=44-55=-11 → "well south" case
    const boldEl = screen.getByText(/Grand Rapids, MI is well south/, { selector: 'span' });
    expect(boldEl).toHaveClass('font-semibold');
  });

  it('rest of location text is at regular weight', () => {
    render(<ViewingWindowModal {...defaultProps} userLat={44.0} userLocationLabel="Grand Rapids, MI" />);
    const restEl = screen.getByText(/very strong storm/, { selector: 'span' });
    expect(restEl).not.toHaveClass('font-semibold');
  });

  it('renders cloud cover label when cloudCoverPct is provided', () => {
    render(<ViewingWindowModal {...defaultProps} cloudCoverPct={25} cloudCoverLabel="Partly cloudy" />);
    const text = screen.getByRole('dialog').textContent ?? '';
    expect(text).toContain('Partly cloudy');
    expect(text).toContain('25%');
  });

  it('shows "great for viewing" when cloudCoverPct <= 20 (line 138 true branch)', () => {
    render(<ViewingWindowModal {...defaultProps} cloudCoverPct={10} cloudCoverLabel="Clear" />);
    expect(screen.getByText(/great for viewing/i)).toBeInTheDocument();
  });

  it('shows "keep watching for gaps" when cloudCoverPct is between 21 and 50 (line 140)', () => {
    render(<ViewingWindowModal {...defaultProps} cloudCoverPct={35} cloudCoverLabel="Partly cloudy" />);
    expect(screen.getByText(/keep watching for gaps/i)).toBeInTheDocument();
  });

  it('shows "Significant cloud cover" when cloudCoverPct > 50 (else branch)', () => {
    render(<ViewingWindowModal {...defaultProps} cloudCoverPct={75} cloudCoverLabel="Mostly cloudy" />);
    expect(screen.getByText(/Significant cloud cover/i)).toBeInTheDocument();
  });

  it('shows Alaska/Canada fallback message when Kp is too low for any city (lines 122–125)', () => {
    // kp=0 → minLat=67; no US city in the dataset reaches 67°N → cities=[]
    render(<ViewingWindowModal kp={0} peakKp={0} onClose={vi.fn()} />);
    expect(screen.getByText(/visible mainly in Alaska and northern Canada/i)).toBeInTheDocument();
  });
});
