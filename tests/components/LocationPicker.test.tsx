import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocationPicker } from '../../components/LocationPicker';

// ── Fetch mock ────────────────────────────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function apiReturns(results: { lat: number; lon: number; label: string }[]) {
  mockFetch.mockResolvedValueOnce({
    json: async () => ({ results }),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LocationPicker', () => {
  it('renders the search input with the placeholder text', () => {
    render(<LocationPicker onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByPlaceholderText(/City, state/i)).toBeInTheDocument();
  });

  it('Search button is disabled when query is empty', () => {
    render(<LocationPicker onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
  });

  it('clicking the X (cancel) button calls onCancel', () => {
    const onCancel = vi.fn();
    render(<LocationPicker onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel location search/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('direct lat/lon input calls onConfirm immediately without fetching', () => {
    const onConfirm = vi.fn();
    render(<LocationPicker onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/City, state/i), {
      target: { value: '47.6, -122.3' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(onConfirm).toHaveBeenCalledWith(47.6, -122.3, '47.6000°, -122.3000°');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('lat/lon without a space also works (no space after comma)', () => {
    const onConfirm = vi.fn();
    render(<LocationPicker onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/City, state/i), {
      target: { value: '-33.8,151.2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(onConfirm).toHaveBeenCalledWith(-33.8, 151.2, '-33.8000°, 151.2000°');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('lat/lon outside valid range (lat > 90) falls through to API search', async () => {
    apiReturns([]);
    render(<LocationPicker onConfirm={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/City, state/i), {
      target: { value: '91, 0' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
  });

  it('shows "…" on the Search button while the request is in flight', async () => {
    let resolve!: (v: unknown) => void;
    mockFetch.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    render(<LocationPicker onConfirm={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/City, state/i), {
      target: { value: 'Seattle' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByRole('button', { name: '…' })).toBeInTheDocument();
    resolve({ json: async () => ({ results: [] }) });
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '…' })).not.toBeInTheDocument()
    );
  });

  it('renders result buttons when API returns matches', async () => {
    apiReturns([
      { lat: 44.97, lon: -93.26, label: 'Minneapolis, MN, US' },
      { lat: 45.52, lon: -122.68, label: 'Portland, OR, US' },
    ]);
    render(<LocationPicker onConfirm={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/City, state/i), {
      target: { value: 'Min' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() =>
      expect(screen.getByText('Minneapolis, MN, US')).toBeInTheDocument()
    );
    expect(screen.getByText('Portland, OR, US')).toBeInTheDocument();
  });

  it("clicking a result calls onConfirm with that result's coordinates", async () => {
    const onConfirm = vi.fn();
    apiReturns([{ lat: 44.97, lon: -93.26, label: 'Minneapolis, MN, US' }]);
    render(<LocationPicker onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/City, state/i), {
      target: { value: 'Minneapolis' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() =>
      expect(screen.getByText('Minneapolis, MN, US')).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText('Minneapolis, MN, US'));
    expect(onConfirm).toHaveBeenCalledWith(44.97, -93.26, 'Minneapolis, MN, US');
  });

  it('shows not-found message when API returns zero results', async () => {
    apiReturns([]);
    render(<LocationPicker onConfirm={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/City, state/i), {
      target: { value: 'Xyzzy' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() =>
      expect(screen.getByText(/No locations found/i)).toBeInTheDocument()
    );
  });

  it('shows not-found message when fetch throws a network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    render(<LocationPicker onConfirm={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/City, state/i), {
      target: { value: 'Denver' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() =>
      expect(screen.getByText(/No locations found/i)).toBeInTheDocument()
    );
  });

  it('typing after a not-found state clears the message', async () => {
    apiReturns([]);
    render(<LocationPicker onConfirm={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/City, state/i), {
      target: { value: 'Xyzzy' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() =>
      expect(screen.getByText(/No locations found/i)).toBeInTheDocument()
    );
    fireEvent.change(screen.getByPlaceholderText(/City, state/i), {
      target: { value: 'Xyzzy2' },
    });
    expect(screen.queryByText(/No locations found/i)).not.toBeInTheDocument();
  });

  it('typing after results are shown clears the result list', async () => {
    apiReturns([{ lat: 47.6, lon: -122.3, label: 'Seattle, WA, US' }]);
    render(<LocationPicker onConfirm={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/City, state/i), {
      target: { value: 'Seattle' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() =>
      expect(screen.getByText('Seattle, WA, US')).toBeInTheDocument()
    );
    fireEvent.change(screen.getByPlaceholderText(/City, state/i), {
      target: { value: 'Sea' },
    });
    expect(screen.queryByText('Seattle, WA, US')).not.toBeInTheDocument();
  });

  it('form submission via Enter key triggers search', async () => {
    apiReturns([{ lat: 51.5, lon: -0.12, label: 'London, UK' }]);
    const { container } = render(<LocationPicker onConfirm={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/City, state/i), {
      target: { value: 'London' },
    });
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() =>
      expect(screen.getByText('London, UK')).toBeInTheDocument()
    );
  });
});
