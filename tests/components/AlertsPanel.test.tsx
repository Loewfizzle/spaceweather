import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AlertsPanel } from '../../components/AlertsPanel';
import type { Alert } from '../../lib/api/schemas';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const defaultProps = {
  riskLevel: 'Moderate' as const,
  isLoading: false,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AlertsPanel', () => {
  it('renders the AURORA ALERTS section title', () => {
    render(<AlertsPanel {...defaultProps} />);
    expect(screen.getByText('AURORA ALERTS')).toBeInTheDocument();
  });

  it('renders the risk pill when riskLevel is provided', () => {
    render(<AlertsPanel {...defaultProps} riskLevel="High" />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('does not render a risk pill when riskLevel is null', () => {
    render(<AlertsPanel {...defaultProps} riskLevel={null} />);
    expect(screen.queryByText('Moderate')).not.toBeInTheDocument();
    expect(screen.queryByText('High')).not.toBeInTheDocument();
    expect(screen.queryByText('Quiet')).not.toBeInTheDocument();
  });

  it('shows loading skeleton when alertsLoading is true and alerts are empty', () => {
    render(<AlertsPanel {...defaultProps} alertsLoading={true} alerts={[]} />);
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });

  it('renders a single NOAA alert with product label and first line', () => {
    const alerts: Alert[] = [
      {
        product_id: 'ALTK05A',
        issue_datetime: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        message: 'Product: ALTK05A\r\n\r\nGeomagnetic storm conditions were observed across the northern US.',
      },
    ];
    render(<AlertsPanel {...defaultProps} alerts={alerts} />);
    expect(screen.getByText(/Geomagnetic storm conditions were observed/i)).toBeInTheDocument();
  });

  it('renders multiple alerts in sequence', () => {
    const alerts: Alert[] = [
      {
        product_id: 'ALTK05A',
        issue_datetime: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        message: 'Product: ALTK05A\r\n\r\nFirst storm alert content.',
      },
      {
        product_id: 'ALTK07A',
        issue_datetime: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        message: 'Product: ALTK07A\r\n\r\nSecond extreme alert content.',
      },
    ];
    render(<AlertsPanel {...defaultProps} alerts={alerts} />);
    expect(screen.getByText(/First storm alert content/i)).toBeInTheDocument();
    expect(screen.getByText(/Second extreme alert content/i)).toBeInTheDocument();
  });

  it('renders no alert rows when alerts array is empty and not loading', () => {
    render(<AlertsPanel {...defaultProps} alerts={[]} alertsLoading={false} />);
    expect(document.querySelectorAll('.animate-pulse').length).toBe(0);
  });
});
