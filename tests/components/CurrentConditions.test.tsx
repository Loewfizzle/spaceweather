import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CurrentConditions } from '../../components/CurrentConditions';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../../components/LoadingSkeleton', () => ({
  LoadingSkeleton: ({ variant }: { variant: string }) => (
    <div data-testid={`loading-skeleton-${variant}`} />
  ),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const defaultProps = {
  solarWindSpeed: 520,
  solarWindDensity: 4.2,
  bz: -6.3,
  kp: 5.0,
  maxAuroraProbNA: 42,
  isLoading: false,
  ovationProcessed: true,
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CurrentConditions', () => {
  it('renders the loading skeleton when isLoading is true', () => {
    render(<CurrentConditions {...defaultProps} isLoading={true} />);
    expect(screen.getByTestId('loading-skeleton-metrics')).toBeInTheDocument();
    expect(screen.queryByText('520')).not.toBeInTheDocument();
  });

  it('renders solar wind speed value', () => {
    render(<CurrentConditions {...defaultProps} />);
    expect(screen.getByText('520')).toBeInTheDocument();
  });

  it('renders Bz value', () => {
    render(<CurrentConditions {...defaultProps} />);
    expect(screen.getByText('-6.3')).toBeInTheDocument();
  });

  it('renders Kp value with tier label', () => {
    render(<CurrentConditions {...defaultProps} />);
    expect(screen.getByText('5.0')).toBeInTheDocument();
    // Kp 5.0 is "Active" tier
    expect(screen.getByText(/Active/)).toBeInTheDocument();
  });

  it('renders OVATION percentage when ovationProcessed is true', () => {
    render(<CurrentConditions {...defaultProps} />);
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('opens the Solar Wind info modal when info button is clicked', () => {
    render(<CurrentConditions {...defaultProps} />);
    const infoBtn = screen.getByRole('button', { name: /About Solar Wind data/i });
    fireEvent.click(infoBtn);
    expect(screen.getByRole('dialog', { name: /Solar Wind/i })).toBeInTheDocument();
  });

  it('opens the IMF Bz info modal', () => {
    render(<CurrentConditions {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /About IMF Bz/i }));
    expect(screen.getByRole('dialog', { name: /IMF Bz/i })).toBeInTheDocument();
  });

  it('opens the Planetary Kp info modal and renders the visibility-by-latitude rows', () => {
    render(<CurrentConditions {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /About Planetary Kp index/i }));
    const dialog = screen.getByRole('dialog', { name: /Planetary Kp/i });
    expect(dialog).toBeInTheDocument();
    // The Kp modal has a "rows" section — verify the table content is present
    expect(screen.getByText('Kp 5')).toBeInTheDocument();
    expect(screen.getByText(/Minneapolis/)).toBeInTheDocument();
  });

  it('opens the OVATION info modal', () => {
    render(<CurrentConditions {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /About OVATION aurora probability/i }));
    expect(screen.getByRole('dialog', { name: /OVATION/i })).toBeInTheDocument();
  });

  it('no dot is rendered during initial load (isLoading=true, kp=null)', () => {
    const { container } = render(
      <CurrentConditions {...defaultProps} kp={null} isLoading={true} />
    );
    // dotColor returns null → the pulse dot span is absent
    expect(container.querySelector('.animate-pulse.block')).not.toBeInTheDocument();
  });

  it('shows a red dot when solarWindError is set and kp is null', () => {
    const { container } = render(
      <CurrentConditions {...defaultProps} kp={null} isLoading={false} solarWindError={new Error('down')} />
    );
    const dot = container.querySelector('.animate-pulse.block') as HTMLElement | null;
    expect(dot).toBeInTheDocument();
    expect(dot?.style.backgroundColor).toBe('rgb(239, 68, 68)');
  });

  it('shows a yellow dot when solarWindError is set but kp is present', () => {
    const { container } = render(
      <CurrentConditions {...defaultProps} kp={3.0} isLoading={false} solarWindError={new Error('partial')} />
    );
    const dot = container.querySelector('.animate-pulse.block') as HTMLElement | null;
    expect(dot).toBeInTheDocument();
    expect(dot?.style.backgroundColor).toBe('rgb(234, 179, 8)');
  });

  it('shows a yellow dot when kp is null with no error and not loading', () => {
    const { container } = render(
      <CurrentConditions {...defaultProps} kp={null} isLoading={false} />
    );
    const dot = container.querySelector('.animate-pulse.block') as HTMLElement | null;
    expect(dot).toBeInTheDocument();
    expect(dot?.style.backgroundColor).toBe('rgb(234, 179, 8)');
  });

  it('renders "—" when solar wind speed and density are null', () => {
    render(
      <CurrentConditions {...defaultProps} solarWindSpeed={null} solarWindDensity={null} />
    );
    // Two "—" values: speed and density
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders "Temporarily unavailable" when ovationProcessed is false', () => {
    render(<CurrentConditions {...defaultProps} ovationProcessed={false} />);
    expect(screen.getByText(/Temporarily unavailable/i)).toBeInTheDocument();
  });

  it('renders "Quiet — aurora oval outside NA" when maxAuroraProbNA is 0', () => {
    render(<CurrentConditions {...defaultProps} maxAuroraProbNA={0} ovationProcessed={true} />);
    expect(screen.getByText(/Quiet — aurora oval outside NA/i)).toBeInTheDocument();
  });
});
