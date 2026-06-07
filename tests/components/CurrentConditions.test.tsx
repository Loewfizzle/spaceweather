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
});
